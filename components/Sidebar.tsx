import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    MENU_DATA, 
    baseAbxData, 
    baseCultureOrganisms, 
    baseGramStainResults, 
    baseBreathingSounds, 
    baseHeartSoundItems, 
    lungZones, 
    abdominalQuadrants, 
    abdominalRegions 
} from '../constants';
import { MenuCategory } from '../types';
import { Search, ChevronDown, ChevronRight, GripVertical, Wind, HeartPulse, Activity, PlusCircle, Save, Star, FolderPlus, FilePlus, Folder, File, Check } from 'lucide-react';

interface SidebarProps {
  onItemClick: (category: string, item: string) => void;
  customItems?: Record<string, string[]>;
  customSubMenus?: Record<string, string[]>;
  onAddCustomItem?: (category: string, item: string) => void;
  onAddCustomSubMenu?: (category: string, subMenuName: string) => void;
  starredItems?: Record<string, string[]>;
  onToggleStar?: (category: string, item: string) => void;
}

// Define structure for sub-items that can include headers
type NestedItem = string | { type: 'header'; label: string };

// Define structure for the "Add Custom Item" cascading menu
interface AddMenuNode {
    label: string;
    target?: string; // If leaf node, this is the category key used for saving
    children?: AddMenuNode[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
    onItemClick, 
    customItems = {}, 
    customSubMenus = {},
    onAddCustomItem,
    onAddCustomSubMenu,
    starredItems = {},
    onToggleStar
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Add Item State
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [addType, setAddType] = useState<'item' | 'category'>('item');
  const [newCustomCategory, setNewCustomCategory] = useState<string>('Symptom'); // The selected target category key
  const [newCustomCategoryLabel, setNewCustomCategoryLabel] = useState<string>('Symptom'); // Display text
  const [newCustomItemName, setNewCustomItemName] = useState('');
  
  // Add Menu Cascading State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredAddCategory, setHoveredAddCategory] = useState<string | null>(null); // Level 1 hover
  const [hoveredAddSubCategory, setHoveredAddSubCategory] = useState<string | null>(null); // Level 2 hover (e.g., Antibiotics)
  
  const addMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [l2SearchTerm, setL2SearchTerm] = useState('');
  const [l3SearchTerm, setL3SearchTerm] = useState('');

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<MenuCategory | null>(null);
  
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const [adjustedFlyoutPos, setAdjustedFlyoutPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  
  const [hoveredSubItem, setHoveredSubItem] = useState<string | null>(null);
  const [subFlyoutPos, setSubFlyoutPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const [adjustedSubFlyoutPos, setAdjustedSubFlyoutPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const flyoutRef = useRef<HTMLDivElement>(null);
  const subFlyoutRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const l2SearchRef = useRef<HTMLInputElement>(null);
  const l3SearchRef = useRef<HTMLInputElement>(null);

  // States for Breathing Sound Grid
  const [selectedBreathingZones, setSelectedBreathingZones] = useState<string[]>([]);
  const [isBilateralBreathing, setIsBilateralBreathing] = useState(false);

  // States for Heart Sound (Murmur)
  const [murmurGrade, setMurmurGrade] = useState<string>('');
  const [selectedMurmurTiming, setSelectedMurmurTiming] = useState<string[]>([]);
  const [selectedMurmurLoc, setSelectedMurmurLoc] = useState<string>('');

  // States for Vital Signs
  const [vitals, setVitals] = useState({ T: '', P: '', R: '', BP: '', SpO2: '', GCS: '' });

  const [abdominalStage, setAbdominalStage] = useState<'zones' | null>(null);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [isDiffuse, setIsDiffuse] = useState(false);
  const [pittingStage, setPittingStage] = useState<'details' | null>(null);
  const [pittingGrade, setPittingGrade] = useState<string>('');
  const [pittingLocation, setPittingLocation] = useState<string>('');

  const visibleCategories: MenuCategory[] = [
    'Vital Sign', 'Symptom', 'Disease', 'Medical Facility', 'Physical examination', 'Lab data', 'Culture / Gram stain', 'Image finding', 'Treatment'
  ];

  // --- Helper: Sort Items with Stars Pinned to Top ---
  const sortItems = useCallback((items: string[], category: string) => {
    const starredList = starredItems[category] || [];
    // Separate starred and unstarred
    const starred = items.filter(i => starredList.includes(i)).sort((a, b) => a.localeCompare(b));
    const unstarred = items.filter(i => !starredList.includes(i)).sort((a, b) => a.localeCompare(b));
    return [...starred, ...unstarred];
  }, [starredItems]);

  const renderStar = (category: string, item: NestedItem, e?: React.MouseEvent) => {
    if (typeof item !== 'string') return null;
    const isStarred = (starredItems[category] || []).includes(item);
    return (
        <button
            className="p-1 mr-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none flex-shrink-0"
            onClick={(ev) => {
                ev.stopPropagation();
                if (onToggleStar) onToggleStar(category, item);
            }}
            title={isStarred ? "Unpin item" : "Pin item to top"}
        >
            <Star 
                className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} 
            />
        </button>
    );
  };

  // --- Dynamic Data Merging Logic ---

  // 1. Main Menu Categories
  const mergedMenuData = useMemo(() => {
    return MENU_DATA.map(group => {
      const customForCategory = customItems[group.category] || [];
      const subMenusForCategory = customSubMenus[group.category] || [];
      // Combine base + custom items + custom sub-menus
      let mergedItems = Array.from(new Set([...group.items, ...customForCategory, ...subMenusForCategory]));
      // Apply Sorting (Starred first)
      mergedItems = sortItems(mergedItems, group.category);
      return { ...group, items: mergedItems };
    });
  }, [customItems, customSubMenus, sortItems]);

  // 2. Antibiotics Categories
  const abxCategories = useMemo(() => {
    const base = Object.keys(baseAbxData);
    const customAbxFolders = customSubMenus['Antibiotics'] || [];
    return [...base, ...customAbxFolders];
  }, [customSubMenus]);
  
  const mergedAbxData = useMemo(() => {
    // Cast baseAbxData to allow dynamic access
    const newData: Record<string, NestedItem[]> = { ...baseAbxData } as unknown as Record<string, NestedItem[]>;
    
    // Iterate over all known categories in abxCategories to ensure we cover custom ones
    abxCategories.forEach(key => {
        const customForClass = customItems[key] || [];
        const currentList = newData[key] || [];
        
        // Merge Custom Items
        let combined: NestedItem[] = [];
        if (customForClass.length > 0) {
            if (key === 'Other (其他抗生素)') {
                 combined = [...currentList, { type: 'header', label: '-- User Added --' } as NestedItem, ...customForClass];
            } else {
                 combined = [...currentList, ...customForClass];
            }
        } else {
            combined = currentList;
        }

        // Apply Sorting Logic
        const starred = starredItems[key] || [];
        const pinnedItems: NestedItem[] = [];
        const restItems: NestedItem[] = [];

        combined.forEach(item => {
            if (typeof item === 'string' && starred.includes(item)) {
                pinnedItems.push(item);
            } else {
                restItems.push(item);
            }
        });
        
        pinnedItems.sort((a, b) => (a as string).localeCompare(b as string));
        // We don't sort restItems to preserve header structure
        newData[key] = [...pinnedItems, ...restItems];
    });

    return newData;
  }, [customItems, starredItems, abxCategories]);

  const mergedCultureOrganisms = useMemo(() => { const custom = customItems['Culture'] || []; const combined = [...baseCultureOrganisms, ...custom]; return sortItems(combined, 'Culture'); }, [customItems, sortItems]);
  const mergedGramStainResults = useMemo(() => { const custom = customItems['Gram stain'] || []; const combined = [...baseGramStainResults, ...custom]; return sortItems(combined, 'Gram stain'); }, [customItems, sortItems]);
  const mergedBreathingSounds = useMemo(() => { const custom = customItems['Breathing sound'] || []; const combined = [...baseBreathingSounds, ...custom]; return sortItems(combined, 'Breathing sound'); }, [customItems, sortItems]);
  const mergedHeartSoundItems = useMemo(() => { const custom = customItems['Heart sound'] || []; const combined = [...baseHeartSoundItems, ...custom]; return sortItems(combined, 'Heart sound'); }, [customItems, sortItems]);

  // Default set to empty array so all menus are collapsed initially
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // --- Add Custom Item Cascading Menu Structure ---
  const ADD_MENU_STRUCTURE: AddMenuNode[] = useMemo(() => [
    { label: 'Vital Sign', target: 'Vital Sign' },
    { label: 'Symptom', target: 'Symptom' },
    { label: 'Negative Symptom', target: 'Negative Symptom' },
    { label: 'Disease', target: 'Disease' },
    { label: 'Medical Facility', target: 'Medical Facility' },
    { 
      label: 'Physical Examination', 
      children: [
        { label: 'General / Other', target: 'Physical examination' },
        { label: 'Breathing sound', target: 'Breathing sound' },
        { label: 'Heart sound', target: 'Heart sound' },
      ]
    },
    {
      label: 'Lab Data / Culture',
      children: [
         { label: 'General Lab Data', target: 'Lab data' },
         { label: 'Culture Organisms', target: 'Culture' },
         { label: 'Gram Stain Results', target: 'Gram stain' }
      ]
    },
    { label: 'Image Finding', target: 'Image finding' },
    {
        label: 'Treatment',
        children: [
            { label: 'General Treatment', target: 'Treatment' },
            { 
                label: 'Antibiotics', 
                children: abxCategories.map(cat => ({ label: cat, target: cat }))
            },
            // Dynamically inject custom sub-menus for Treatment
            ...(customSubMenus['Treatment'] || []).map(sub => ({
                label: sub,
                target: sub
            }))
        ]
    },
  ], [abxCategories, customSubMenus]);

  // Recursively inject custom sub-menus into the structure for generic handling
  const DYNAMIC_ADD_MENU = useMemo(() => {
      const injectSubMenus = (nodes: AddMenuNode[]): AddMenuNode[] => {
          return nodes.map(node => {
              // If this node corresponds to a main category that has custom sub-menus
              if (node.target && customSubMenus[node.target]) {
                  const subs = customSubMenus[node.target].map(sub => ({
                      label: sub,
                      target: sub
                  }));
                  return {
                      ...node,
                      children: [...(node.children || []), ...subs]
                  };
              }
              if (node.children) {
                  return { ...node, children: injectSubMenus(node.children) };
              }
              return node;
          });
      };
      return injectSubMenus(ADD_MENU_STRUCTURE);
  }, [ADD_MENU_STRUCTURE, customSubMenus]);


  // Add Menu Interaction Handlers
  const handleToggleAddMenu = () => {
    if (isAddMenuOpen) {
        setIsAddMenuOpen(false);
        setHoveredAddCategory(null);
        setHoveredAddSubCategory(null);
    } else {
        if (addMenuTriggerRef.current) {
            const rect = addMenuTriggerRef.current.getBoundingClientRect();
            setAddMenuPos({ top: rect.bottom + 4, left: rect.left });
        }
        setIsAddMenuOpen(true);
    }
  };

  const handleSelectTargetCategory = (target: string, label: string) => {
    setNewCustomCategory(target);
    setNewCustomCategoryLabel(label);
    setIsAddMenuOpen(false);
    setHoveredAddCategory(null);
    setHoveredAddSubCategory(null);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (isAddMenuOpen && addMenuRef.current && !addMenuRef.current.contains(e.target as Node) && !addMenuTriggerRef.current?.contains(e.target as Node)) {
            setIsAddMenuOpen(false);
            setHoveredAddCategory(null);
            setHoveredAddSubCategory(null);
        }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);


  const startCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setHoveredItem(null);
      setHoveredSubItem(null);
      resetSubStates();
    }, 150);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (hoveredItem && l2SearchRef.current) l2SearchRef.current.focus();
  }, [hoveredItem]);

  useEffect(() => {
    if ((hoveredSubItem || abdominalStage) && l3SearchRef.current) l3SearchRef.current.focus();
  }, [hoveredSubItem, abdominalStage]);

  useLayoutEffect(() => {
    if (flyoutPos && flyoutRef.current) {
      const rect = flyoutRef.current.getBoundingClientRect();
      const padding = 16;
      let { top, left } = flyoutPos;
      if (top + rect.height > window.innerHeight - padding) top = Math.max(padding, window.innerHeight - rect.height - padding);
      if (left + rect.width > window.innerWidth - padding) left = Math.max(padding, window.innerWidth - rect.width - padding);
      setAdjustedFlyoutPos({ top, left, width: rect.width, maxHeight: window.innerHeight - top - padding });
    }
  }, [flyoutPos, hoveredItem]);

  useLayoutEffect(() => {
    if (subFlyoutPos && subFlyoutRef.current) {
      const rect = subFlyoutRef.current.getBoundingClientRect();
      const padding = 16;
      let { top, left } = subFlyoutPos;
      if (top + rect.height > window.innerHeight - padding) top = Math.max(padding, window.innerHeight - rect.height - padding);
      if (adjustedFlyoutPos && (left + rect.width > window.innerWidth - padding)) {
         left = Math.max(padding, adjustedFlyoutPos.left - rect.width - 4);
      }
      setAdjustedSubFlyoutPos({ top, left, width: rect.width, maxHeight: window.innerHeight - top - padding });
    }
  }, [subFlyoutPos, adjustedFlyoutPos, hoveredSubItem, abdominalStage]);

  const resetSubStates = () => {
    setSelectedZones([]);
    setIsDiffuse(false);
    setAbdominalStage(null);
    setPittingStage(null);
    setPittingGrade('');
    setPittingLocation('');
    setL2SearchTerm('');
    setL3SearchTerm('');
    setSelectedBreathingZones([]);
    setIsBilateralBreathing(false);
    setMurmurGrade('');
    setSelectedMurmurTiming([]);
    setSelectedMurmurLoc('');
  };

  const handleMouseEnterItem = (e: React.MouseEvent, item: string, category: MenuCategory) => {
    clearCloseTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem(item);
    setHoveredCategory(category);
    setL2SearchTerm('');
    setFlyoutPos({ top: rect.top, left: rect.right + 4, right: rect.right });
    if (hoveredItem !== item) {
        setHoveredSubItem(null);
        resetSubStates();
    }
  };

  const handleMouseEnterSubItem = (e: React.MouseEvent, sub: string) => {
    clearCloseTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSubItem(sub);
    setL3SearchTerm('');
    setSubFlyoutPos({ top: rect.top, left: rect.right + 4, right: rect.right });
  };

  const toggleBreathingZone = (zoneId: string) => {
    setIsBilateralBreathing(false);
    setSelectedBreathingZones(prev => 
      prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId]
    );
  };

  const handleInsertBreathing = () => {
    const loc = isBilateralBreathing ? 'Bilateral' : selectedBreathingZones.join(', ');
    if (loc) {
      onItemClick('Physical examination', `${hoveredSubItem} at ${loc}`);
    } else {
      onItemClick('Physical examination', hoveredSubItem!);
    }
    setHoveredItem(null);
    resetSubStates();
  };

  const handleInsertMurmur = () => {
    const intensity = murmurGrade ? `Grade ${murmurGrade}/6` : '';
    const timing = selectedMurmurTiming.length > 0 ? selectedMurmurTiming.join(', ') : '';
    const location = selectedMurmurLoc ? `at ${selectedMurmurLoc}` : '';
    const parts = [intensity, timing, location].filter(Boolean);
    const final = `Murmur: ${parts.join(' ')}`;
    onItemClick('Physical examination', final);
    setHoveredItem(null);
    resetSubStates();
  };

  const handleInsertVitals = () => {
    const parts = [];
    if (vitals.T) parts.push(`T: ${vitals.T} C`);
    if (vitals.P) parts.push(`P: ${vitals.P} bpm`);
    if (vitals.R) parts.push(`R: ${vitals.R} /min`);
    if (vitals.BP) parts.push(`BP: ${vitals.BP} mmHg`);
    if (vitals.SpO2) parts.push(`SpO2: ${vitals.SpO2} %`);
    if (vitals.GCS) parts.push(`GCS: ${vitals.GCS}`);
    
    if (parts.length > 0) {
      onItemClick('Vital Sign', parts.join(', '));
      setVitals({ T: '', P: '', R: '', BP: '', SpO2: '', GCS: '' });
      setHoveredItem(null);
      resetSubStates();
    }
  };

  const handleMouseEnterYes = (e: React.MouseEvent, stage: 'zones' | 'details') => {
    clearCloseTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    if (stage === 'zones') {
        setSubFlyoutPos({ top: rect.top, left: rect.right + 4, right: rect.right });
        setAbdominalStage('zones');
        setL3SearchTerm('');
    } else {
        setSubFlyoutPos({ top: rect.top, left: rect.right + 4, right: rect.right });
        setPittingStage('details');
        setL3SearchTerm('');
    }
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZones(prev => prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId]);
    setIsDiffuse(false);
  };

  const handleSaveCustomItem = () => {
    if (!newCustomItemName.trim()) return;
    
    if (addType === 'item') {
        if (onAddCustomItem) {
            onAddCustomItem(newCustomCategory, newCustomItemName.trim());
        }
    } else {
        if (onAddCustomSubMenu) {
            onAddCustomSubMenu(newCustomCategory, newCustomItemName.trim());
        }
    }
    setNewCustomItemName('');
  };

  const fuzzyFilter = <T extends string | NestedItem>(items: T[], term: string): T[] => {
    if (!term) return items;
    const lowerTerm = term.toLowerCase();
    return items.filter(item => {
      const label = typeof item === 'string' ? item : item.label;
      return label.toLowerCase().includes(lowerTerm);
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 overflow-visible relative">
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Menu Source</h2>
        <div className="relative mb-3">
          <input type="text" placeholder="Search categories..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
        </div>
        
        {/* User Add Item Section */}
        <div className="mt-1" id="tour-add-custom">
            {!showAddCustom ? (
                <button 
                  onClick={() => setShowAddCustom(true)}
                  className="w-full flex items-center justify-center py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-100"
                >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Add Custom Item
                </button>
            ) : (
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 animate-in zoom-in-95 duration-150 relative">
                    <div className="flex bg-slate-100 rounded-md p-0.5 mb-2">
                        <button 
                            onClick={() => setAddType('item')}
                            className={`flex-1 flex items-center justify-center py-1 text-[10px] font-bold rounded-sm transition-all ${addType === 'item' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FilePlus className="w-3 h-3 mr-1" />
                            Item
                        </button>
                        <button 
                            onClick={() => setAddType('category')}
                            className={`flex-1 flex items-center justify-center py-1 text-[10px] font-bold rounded-sm transition-all ${addType === 'category' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FolderPlus className="w-3 h-3 mr-1" />
                            Category
                        </button>
                    </div>

                    {/* Cascading Menu Trigger */}
                    <button 
                        ref={addMenuTriggerRef}
                        onClick={handleToggleAddMenu}
                        className="w-full p-2 mb-2 text-xs border border-slate-300 rounded outline-none focus:border-blue-500 bg-white text-left flex justify-between items-center"
                    >
                        <div className="flex items-center min-w-0">
                            <span className="text-slate-400 mr-2 text-[10px] font-mono">IN:</span>
                            <span className="truncate font-semibold text-slate-700">{newCustomCategoryLabel}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* Cascading Menu Portal */}
                    {isAddMenuOpen && addMenuPos && createPortal(
                        <div 
                            ref={addMenuRef}
                            className="fixed z-[99999] bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100 flex flex-row"
                            style={{ top: addMenuPos.top, left: addMenuPos.left }}
                        >
                            <div className="w-48 py-1 overflow-y-auto max-h-80 border-r border-slate-100">
                                {DYNAMIC_ADD_MENU.map((node) => {
                                    const hasChildren = node.children && node.children.length > 0;
                                    const isHovered = hoveredAddCategory === node.label;
                                    return (
                                        <div
                                            key={node.label}
                                            onMouseEnter={() => { setHoveredAddCategory(node.label); setHoveredAddSubCategory(null); }}
                                            onClick={() => !hasChildren && node.target && handleSelectTargetCategory(node.target, node.label)}
                                            className={`px-3 py-2 text-xs cursor-pointer flex justify-between items-center ${
                                                isHovered ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                {node.target && <Folder className="w-3 h-3 mr-2 text-slate-400" />}
                                                {node.label}
                                            </div>
                                            {hasChildren ? <ChevronRight className="w-3 h-3 text-slate-400" /> : (
                                                node.target && <Check className={`w-3 h-3 ${newCustomCategory === node.target ? 'text-blue-600' : 'opacity-0'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Level 2: Sub-Menu */}
                            {hoveredAddCategory && (
                                (() => {
                                    const parent = DYNAMIC_ADD_MENU.find(n => n.label === hoveredAddCategory);
                                    if (!parent || !parent.children) return null;
                                    return (
                                        <div className="w-48 py-1 overflow-y-auto max-h-80 border-r border-slate-100 bg-white animate-in slide-in-from-left-2 duration-150">
                                            {parent.children.map((child) => {
                                                const hasGrandChildren = child.children && child.children.length > 0;
                                                const isHovered = hoveredAddSubCategory === child.label;
                                                return (
                                                    <div
                                                        key={child.label}
                                                        onMouseEnter={() => setHoveredAddSubCategory(child.label)}
                                                        onClick={() => !hasGrandChildren && child.target && handleSelectTargetCategory(child.target, child.target)}
                                                        className={`px-3 py-2 text-xs cursor-pointer flex justify-between items-center ${
                                                            isHovered ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center">
                                                            {child.target && <Folder className="w-3 h-3 mr-2 text-slate-400" />}
                                                            {child.label}
                                                        </div>
                                                        {hasGrandChildren ? <ChevronRight className="w-3 h-3 text-slate-400" /> : (
                                                            child.target && <Check className={`w-3 h-3 ${newCustomCategory === child.target ? 'text-blue-600' : 'opacity-0'}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            )}

                            {/* Level 3: Nested Detail Menu */}
                            {hoveredAddSubCategory && (
                                (() => {
                                    const parent = DYNAMIC_ADD_MENU.find(n => n.label === hoveredAddCategory);
                                    const subParent = parent?.children?.find(c => c.label === hoveredAddSubCategory);
                                    if (!subParent || !subParent.children) return null;
                                    return (
                                        <div className="w-56 py-1 overflow-y-auto max-h-80 bg-white animate-in slide-in-from-left-2 duration-150">
                                            {subParent.children.map((grandChild) => (
                                                <div
                                                    key={grandChild.label}
                                                    onClick={() => grandChild.target && handleSelectTargetCategory(grandChild.target, grandChild.label)}
                                                    className="px-3 py-2 text-xs cursor-pointer text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:font-semibold flex items-center justify-between"
                                                >
                                                    <div className="flex items-center">
                                                        {grandChild.target && <Folder className="w-3 h-3 mr-2 text-slate-400" />}
                                                        {grandChild.label}
                                                    </div>
                                                    {grandChild.target && <Check className={`w-3 h-3 ${newCustomCategory === grandChild.target ? 'text-blue-600' : 'opacity-0'}`} />}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>,
                        document.body
                    )}

                    <div className="flex space-x-1">
                        <input 
                            type="text" 
                            className="flex-1 p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-blue-500"
                            placeholder={addType === 'item' ? "Item Name" : "Folder Name"}
                            value={newCustomItemName}
                            onChange={(e) => setNewCustomItemName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomItem()}
                        />
                        <button 
                            onClick={handleSaveCustomItem}
                            disabled={!newCustomItemName.trim()}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
                        >
                            <Save className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={() => setShowAddCustom(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600"
                        >
                            <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {mergedMenuData.map((group) => {
            if (!visibleCategories.includes(group.category)) return null;
            const filteredItems = group.items.filter(i => i.toLowerCase().includes(searchTerm.toLowerCase()));
            if (searchTerm && filteredItems.length === 0) return null;
            const isExpanded = expandedCategories.includes(group.category);
            const colorClass = group.category === 'Vital Sign' ? 'text-green-600 hover:bg-green-50' : 
                               group.category === 'Medical Facility' ? 'text-blue-600 hover:bg-blue-50' : 
                               group.category === 'Culture / Gram stain' ? 'text-cyan-600 hover:bg-cyan-50' : 
                               group.category === 'Lab data' ? 'text-orange-600 hover:bg-orange-50' : 'text-slate-600 hover:bg-slate-100';

            return (
              <div 
                key={group.category} 
                className="mb-2" 
                id={group.category === 'Symptom' ? 'tour-symptom-category' : undefined}
              >
                <button onClick={() => setExpandedCategories(prev => prev.includes(group.category) ? prev.filter(c => c !== group.category) : [...prev, group.category])} className={`w-full flex items-center px-2 py-2 text-sm font-semibold rounded-md transition-colors ${colorClass}`}>
                  {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                  {group.category}
                </button>
                {isExpanded && (
                  <div className="pl-4 mt-1 space-y-1">
                    {filteredItems.map((item) => {
                      // Check if this item is a custom sub-menu (folder)
                      const isCustomSubMenu = customSubMenus[group.category]?.includes(item);
                      
                      const hasFlyout = (
                        group.category === 'Vital Sign' ||
                        group.category === 'Symptom' ||
                        group.category === 'Disease' ||
                        group.category === 'Medical Facility' ||
                        group.category === 'Physical examination' ||
                        group.category === 'Culture / Gram stain' ||
                        (group.category === 'Treatment' && item === 'Antibiotics') ||
                        isCustomSubMenu
                      );
                      
                      return (
                        <div key={item}
                          onMouseEnter={(e) => hasFlyout && handleMouseEnterItem(e, item, group.category)}
                          onMouseLeave={startCloseTimer}
                          onClick={() => !hasFlyout && onItemClick(group.category, item)}
                          className={`group relative flex items-center justify-between px-3 py-2 text-sm text-slate-700 bg-white border rounded-md transition-all active:scale-95 cursor-pointer ${hoveredItem === item ? 'border-blue-400 bg-blue-50/30 shadow-sm' : 'border-slate-200 hover:border-blue-400 hover:shadow-sm'}`}
                        >
                           <div className="flex items-center min-w-0">
                               {/* Render Star for item */}
                               {renderStar(group.category, item)}
                               {isCustomSubMenu && <Folder className="w-3.5 h-3.5 mr-2 text-slate-400 flex-shrink-0" />}
                               <span className="truncate">{item}</span>
                           </div>
                          {hasFlyout ? <ChevronRight className={`w-3 h-3 ${hoveredItem === item ? 'opacity-100' : 'text-slate-300 opacity-60 group-hover:opacity-100'}`} /> : <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
        })}
      </div>

      {/* Flyout Layer 2 */}
      {hoveredItem && flyoutPos && createPortal(
        <div 
          ref={flyoutRef}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={startCloseTimer}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-2xl animate-in fade-in slide-in-from-left-1 duration-150 min-w-[220px] max-w-[340px] overflow-hidden flex flex-col" 
          style={{ 
            top: adjustedFlyoutPos?.top ?? flyoutPos.top, 
            left: adjustedFlyoutPos?.left ?? flyoutPos.left,
            maxHeight: adjustedFlyoutPos?.maxHeight ?? '80vh'
          }}
        >
          {hoveredCategory !== 'Vital Sign' && hoveredCategory !== 'Medical Facility' && (
            <div className="p-2 bg-slate-50 border-b flex-shrink-0">
              <div className="relative">
                <input ref={l2SearchRef} type="text" placeholder="Search..." className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500" value={l2SearchTerm} onChange={(e) => setL2SearchTerm(e.target.value)} />
                <Search className="absolute left-2.5 top-1.5 text-slate-400 w-3.5 h-3.5" />
              </div>
            </div>
          )}

          <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
             {customSubMenus[hoveredCategory]?.includes(hoveredItem!) && (() => {
                const itemsInFolder = customItems[hoveredItem!] || [];
                const sorted = sortItems(itemsInFolder, hoveredItem!);
                const filtered = fuzzyFilter(sorted, l2SearchTerm);
                return filtered.map(sub => (
                    <button 
                        key={sub} 
                        onClick={() => { onItemClick(hoveredCategory!, sub); setHoveredItem(null); resetSubStates(); }} 
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 flex items-center"
                    >
                        {renderStar(hoveredItem!, sub)}
                        <File className="w-3.5 h-3.5 mr-2 text-slate-300" />
                        {sub}
                    </button>
                ));
            })()}

            {hoveredCategory === 'Medical Facility' && sortItems(['Emergency Department', 'Outpatient Department'], 'Medical Facility').map(dept => (
              <button 
                key={dept} 
                onClick={() => { 
                  const cleanName = hoveredItem!.replace(/\s*\(.*?\)/, '');
                  onItemClick('Medical Facility', `the ${dept} of ${cleanName}`); 
                  setHoveredItem(null); 
                  resetSubStates(); 
                }} 
                className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-blue-50 text-blue-700 transition-colors border-b border-slate-50 last:border-0 flex items-center"
              >
                {renderStar('Medical Facility', dept)}
                {dept}
              </button>
            ))}

            {hoveredCategory === 'Culture / Gram stain' && fuzzyFilter(sortItems(['Culture', 'Gram stain'], 'Culture / Gram stain'), l2SearchTerm).map(opt => (
              <div 
                key={opt} 
                onMouseEnter={(e) => handleMouseEnterSubItem(e, opt)} 
                className={`px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer border-b last:border-0 transition-colors ${hoveredSubItem === opt ? 'bg-cyan-50 text-cyan-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <div className="flex items-center">
                    {renderStar('Culture / Gram stain', opt)}
                    {opt}
                </div>
                <ChevronRight className="w-3 h-3" />
              </div>
            ))}

            {hoveredCategory === 'Vital Sign' && hoveredItem === 'Vital sign' && (
              <div className="p-4 w-72 space-y-4">
                <div className="flex items-center space-x-2 text-green-600 mb-2 font-bold text-xs uppercase tracking-wider">
                  <Activity className="w-4 h-4" />
                  <span>Vital Sign Entry</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">T (°C)</label>
                    <input type="text" placeholder="37.0" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.T} onChange={(e) => setVitals({...vitals, T: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">P (bpm)</label>
                    <input type="text" placeholder="80" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.P} onChange={(e) => setVitals({...vitals, P: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">R (/min)</label>
                    <input type="text" placeholder="18" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.R} onChange={(e) => setVitals({...vitals, R: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">SpO2 (%)</label>
                    <input type="text" placeholder="98" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.SpO2} onChange={(e) => setVitals({...vitals, SpO2: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">BP (mmHg)</label>
                  <input type="text" placeholder="120/80" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.BP} onChange={(e) => setVitals({...vitals, BP: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">GCS</label>
                  <input type="text" placeholder="E4V5M6" className="w-full p-2 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 outline-none" value={vitals.GCS} onChange={(e) => setVitals({...vitals, GCS: e.target.value})} />
                </div>

                <button onClick={handleInsertVitals} className="w-full py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-green-700 active:scale-95 transition-all">Insert Vital Signs</button>
              </div>
            )}
            
            {hoveredCategory === 'Symptom' && fuzzyFilter(sortItems(['Positive', 'Negative'], 'Symptom'), l2SearchTerm).map(opt => (
                <button key={opt} onClick={() => { onItemClick(opt === 'Positive' ? 'Symptom' : 'Negative Symptom', hoveredItem!); setHoveredItem(null); resetSubStates(); }} className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors border-b border-slate-50 last:border-0 flex items-center ${opt === 'Positive' ? 'hover:bg-blue-50 text-blue-700' : 'hover:bg-red-50 text-red-700'}`}>
                    {renderStar('Symptom', opt)}
                    {opt}
                </button>
            ))}

            {hoveredCategory === 'Disease' && fuzzyFilter(sortItems(['Tentative Diagnosis', 'Underlying Disease', 'Definitive Disease'], 'Disease'), l2SearchTerm).map(opt => (
              <button key={opt} onClick={() => { const targetCategory = opt === 'Underlying Disease' ? 'Underlying disease' : opt === 'Definitive Disease' ? 'Definitive diagnosis' : opt; onItemClick(targetCategory, hoveredItem!); setHoveredItem(null); resetSubStates(); }} className="w-full px-4 py-3 text-left text-sm font-semibold transition-colors border-b border-slate-50 last:border-0 hover:bg-indigo-50 text-indigo-700 flex items-center">
                  {renderStar('Disease', opt)}
                  {opt}
              </button>
            ))}
            
            {hoveredCategory === 'Physical examination' && hoveredItem === 'Breathing sound' && fuzzyFilter(mergedBreathingSounds, l2SearchTerm).map(sub => (
              <div key={sub} onMouseEnter={(e) => handleMouseEnterSubItem(e, sub)} className={`px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer border-b last:border-0 transition-colors ${hoveredSubItem === sub ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}>
                <div className="flex items-center">
                    {renderStar('Breathing sound', sub)}
                    {sub}
                </div>
                <ChevronRight className="w-3 h-3" />
              </div>
            ))}
            
            {hoveredCategory === 'Physical examination' && hoveredItem === 'Heart sound' && fuzzyFilter(mergedHeartSoundItems, l2SearchTerm).map(sub => (
              <div key={sub} onMouseEnter={(e) => handleMouseEnterSubItem(e, sub)} className={`px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer border-b last:border-0 transition-colors ${hoveredSubItem === sub ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}>
                <div className="flex items-center">
                    {renderStar('Heart sound', sub)}
                    {sub}
                </div>
                <ChevronRight className="w-3 h-3" />
              </div>
            ))}

            {hoveredCategory === 'Treatment' && hoveredItem === 'Antibiotics' && fuzzyFilter<string>(abxCategories, l2SearchTerm).map(cls => (
                <div key={cls} onMouseEnter={(e) => handleMouseEnterSubItem(e, cls)} className={`px-4 py-3 text-sm font-semibold flex items-center justify-between cursor-pointer border-b last:border-0 transition-colors ${hoveredSubItem === cls ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <div className="flex items-center">
                        {renderStar('Antibiotics', cls)}
                        {customSubMenus['Antibiotics']?.includes(cls) && <Folder className="w-3.5 h-3.5 mr-2 text-slate-400" />}
                        {cls}
                    </div>
                    <ChevronRight className="w-3 h-3" />
                </div>
            ))}

            {hoveredCategory === 'Physical examination' && (hoveredItem === 'Abdominal tenderness' || hoveredItem === 'Rebound tenderness' || hoveredItem === 'Muscle guarding' || hoveredItem === 'Knocking pain') && fuzzyFilter(sortItems(['Yes', 'No'], hoveredItem), l2SearchTerm).map(choice => (
                <button key={choice} onMouseEnter={(e) => choice === 'Yes' ? handleMouseEnterYes(e, 'zones') : undefined} onClick={() => choice === 'No' && (onItemClick('Physical examination', `No ${hoveredItem}`), setHoveredItem(null), resetSubStates())} className={`w-full px-4 py-3 text-left text-sm font-semibold flex justify-between items-center transition-colors border-b last:border-0 ${choice === 'Yes' && abdominalStage ? 'bg-green-50 text-green-700' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center">
                        {renderStar(hoveredItem!, choice)}
                        {choice}
                    </div>
                    {choice === 'Yes' && <ChevronRight className="w-4 h-4"/>}
                </button>
            ))}
             {hoveredCategory === 'Physical examination' && hoveredItem === 'Pitting edema' && fuzzyFilter(sortItems(['Yes', 'No'], hoveredItem), l2SearchTerm).map(choice => (
                <button key={choice} onMouseEnter={(e) => choice === 'Yes' ? handleMouseEnterYes(e, 'details') : undefined} onClick={() => choice === 'No' && (onItemClick('Physical examination', 'No pitting edema'), setHoveredItem(null), resetSubStates())} className={`w-full px-4 py-3 text-left text-sm font-semibold flex justify-between items-center transition-colors border-b last:border-0 ${choice === 'Yes' && pittingStage ? 'bg-green-50 text-green-700' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center">
                        {renderStar(hoveredItem!, choice)}
                        {choice}
                    </div>
                    {choice === 'Yes' && <ChevronRight className="w-4 h-4"/>}
                </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Nested Flyout (Layer 3) */}
      {(hoveredSubItem || abdominalStage || pittingStage) && subFlyoutPos && createPortal(
        <div 
          ref={subFlyoutRef}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={startCloseTimer}
          className="fixed z-[10000] bg-white border border-slate-200 rounded-lg shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200 min-w-[260px] max-w-[420px] overflow-hidden flex flex-col" 
          style={{ 
            top: adjustedSubFlyoutPos?.top ?? subFlyoutPos.top, 
            left: adjustedSubFlyoutPos?.left ?? subFlyoutPos.left,
            maxHeight: adjustedSubFlyoutPos?.maxHeight ?? '80vh'
          }}
        >
          <div className="p-2 bg-slate-50 border-b flex-shrink-0">
            <div className="relative">
              <input ref={l3SearchRef} type="text" placeholder="Search..." className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500" value={l3SearchTerm} onChange={(e) => setL3SearchTerm(e.target.value)} />
              <Search className="absolute left-2.5 top-1.5 text-slate-400 w-3.5 h-3.5" />
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
             {hoveredCategory === 'Culture / Gram stain' && hoveredSubItem === 'Culture' && fuzzyFilter(mergedCultureOrganisms, l3SearchTerm).map(org => (
                <button key={org} onClick={() => { onItemClick('Lab data', `${hoveredItem} Culture: ${org}`); setHoveredItem(null); resetSubStates(); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-cyan-50 hover:text-cyan-700 transition-colors border-b border-slate-50 last:border-0 flex items-center">
                    {renderStar('Culture', org)}
                    {org}
                </button>
             ))}
             {hoveredCategory === 'Culture / Gram stain' && hoveredSubItem === 'Gram stain' && fuzzyFilter(mergedGramStainResults, l3SearchTerm).map(stain => (
                <button key={stain} onClick={() => { onItemClick('Lab data', `${hoveredItem} Gram stain: ${stain}`); setHoveredItem(null); resetSubStates(); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-cyan-50 hover:text-cyan-700 transition-colors border-b border-slate-50 last:border-0 flex items-center">
                    {renderStar('Gram stain', stain)}
                    {stain}
                </button>
             ))}
             
             {hoveredCategory === 'Physical examination' && hoveredItem === 'Breathing sound' && (
                <div className="p-4 w-64 space-y-4">
                  <div className="flex items-center space-x-2 text-blue-600 mb-2 font-bold text-xs uppercase tracking-wider"><Wind className="w-4 h-4" /><span>Zone Selector</span></div>
                  <button onClick={() => { setIsBilateralBreathing(!isBilateralBreathing); setSelectedBreathingZones([]); }} className={`w-full py-2.5 rounded-lg text-sm font-bold border-2 transition-all ${isBilateralBreathing ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50'}`}>Bilateral</button>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-[10px] font-bold text-slate-400 text-center uppercase py-1 bg-slate-50 rounded">Right</div>
                    <div className="text-[10px] font-bold text-slate-400 text-center uppercase py-1 bg-slate-50 rounded">Left</div>
                    {lungZones.map(z => (<button key={z.id} onClick={() => toggleBreathingZone(z.id)} className={`py-3 text-xs font-bold border-2 rounded-lg transition-all ${selectedBreathingZones.includes(z.id) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'}`}>{z.label}</button>))}
                  </div>
                  <button onClick={handleInsertBreathing} className="w-full py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all">Insert Findings</button>
                </div>
             )}

             {hoveredCategory === 'Physical examination' && hoveredSubItem === 'Heart Beats' && fuzzyFilter(sortItems(['regular', 'irregular'], 'Heart Beats'), l3SearchTerm).map(opt => (
                <button key={opt} onClick={() => { onItemClick('Physical examination', `Heart Beats: ${opt}`); setHoveredItem(null); resetSubStates(); }} className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0 flex items-center">
                    {renderStar('Heart Beats', opt)}
                    {opt}
                </button>
             ))}
             
             {hoveredCategory === 'Physical examination' && hoveredSubItem === 'Murmur' && (
                <div className="p-4 w-72 space-y-4">
                  <div className="flex items-center space-x-2 text-indigo-600 mb-2 font-bold text-xs uppercase tracking-wider"><HeartPulse className="w-4 h-4" /><span>Murmur Detail</span></div>
                  {/* Murmur UI */}
                  <section><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Intensity (Grade 1-6)</label>
                    <div className="grid grid-cols-6 gap-1">{[1, 2, 3, 4, 5, 6].map(g => (<button key={g} onClick={() => setMurmurGrade(g.toString())} className={`py-1.5 text-xs font-bold border-2 rounded-md transition-all ${murmurGrade === g.toString() ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-50 border-slate-100'}`}>{g}</button>))}</div>
                  </section>
                  <section><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Timing</label>
                    <div className="grid grid-cols-2 gap-2"><div className="text-[9px] font-bold text-slate-300 text-center uppercase">Early</div><div className="text-[9px] font-bold text-slate-300 text-center uppercase">Late</div>
                      {['Systolic', 'Diastolic'].map(row => (
                        <React.Fragment key={row}>
                          {['Early', 'Late'].map(col => {
                            const id = `${col} ${row}`; const isSelected = selectedMurmurTiming.includes(id);
                            return (<button key={id} onClick={() => setSelectedMurmurTiming(prev => isSelected ? prev.filter(t => t !== id) : [...prev, id])} className={`py-2 text-[10px] font-bold border-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100'}`}>{id}</button>);
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </section>
                  <section><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Location</label>
                    <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                      {sortItems(['Aortic Area', 'Pulmonic Area', 'Tricuspid Area', 'Mitral Area, Apex'], 'Murmur').map(loc => (<button key={loc} onClick={() => setSelectedMurmurLoc(loc)} className={`px-3 py-1.5 text-left text-[11px] font-semibold rounded-md transition-colors flex items-center justify-between ${selectedMurmurLoc === loc ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white'}`}>
                        <span>{loc}</span>
                        {renderStar('Murmur', loc)}
                      </button>))}
                    </div>
                  </section>
                  <button onClick={handleInsertMurmur} className="w-full py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all">Insert Murmur</button>
                </div>
             )}

             {hoveredCategory === 'Treatment' && hoveredSubItem && mergedAbxData[hoveredSubItem] && fuzzyFilter<NestedItem>(mergedAbxData[hoveredSubItem], l3SearchTerm).map((item, idx) => {
                if (typeof item !== 'string' && item.type === 'header') { return <div key={`h-${idx}`} className="px-4 py-1.5 bg-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</div>; }
                const label = typeof item === 'string' ? item : item.label;
                return (<button key={label} onClick={() => { onItemClick('Treatment', label); setHoveredItem(null); resetSubStates(); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 flex items-center">
                    {renderStar(hoveredSubItem!, label)}
                    {label}
                </button>);
             })}
             
             {abdominalStage === 'zones' && (
                <div className="p-4 w-72 space-y-4">
                    <button onClick={() => { setIsDiffuse(!isDiffuse); setSelectedZones([]); }} className={`w-full py-2.5 rounded-lg text-sm font-bold border-2 transition-all ${isDiffuse ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50'}`}>Diffuse</button>
                    <section><label className="text-[10px] font-bold text-slate-400 uppercase mb-2">Quadrants</label><div className="grid grid-cols-2 gap-2">{fuzzyFilter(abdominalQuadrants, l3SearchTerm).map(q => (<button key={q} onClick={() => toggleZone(q)} className={`py-2 text-xs font-bold border-2 rounded-lg transition-all ${selectedZones.includes(q) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100'}`}>{q}</button>))}</div></section>
                    <section className="pt-2 border-t border-slate-100"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Regions</label><div className="grid grid-cols-3 gap-1">{fuzzyFilter(abdominalRegions, l3SearchTerm).map((r) => (<button key={r} onClick={() => toggleZone(r)} className={`p-1 text-[8px] leading-tight font-bold border-2 rounded-md h-12 flex items-center justify-center text-center ${selectedZones.includes(r) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100'}`}>{r.replace(' Region', '').replace(' / ', '\n')}</button>))}</div></section>
                    <button onClick={() => { const result = isDiffuse ? `${hoveredItem}: diffuse` : (selectedZones.length > 0 ? `${hoveredItem} at ${selectedZones.join(', ')}` : ''); if (result) { onItemClick('Physical examination', result); setHoveredItem(null); resetSubStates(); } }} disabled={!isDiffuse && selectedZones.length === 0} className={`w-full py-3 rounded-xl text-sm font-bold shadow-lg transition-all ${(!isDiffuse && selectedZones.length === 0) ? 'bg-slate-200 text-slate-400' : 'bg-green-600 text-white hover:bg-green-700'}`}>Insert Findings</button>
                </div>
             )}

             {pittingStage === 'details' && (
                <div className="p-5 w-60 space-y-5">
                   <section><label className="block text-[10px] font-bold text-slate-400 uppercase mb-3">Grade</label><div className="grid grid-cols-4 gap-1.5">{fuzzyFilter(['1+', '2+', '3+', '4+'], l3SearchTerm).map(g => (<button key={g} onClick={() => setPittingGrade(g)} className={`py-2 text-xs font-bold border-2 rounded-lg transition-all ${pittingGrade === g ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-blue-50'}`}>{g}</button>))}</div></section>
                   <section><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Location</label><input type="text" placeholder="e.g. Bilateral lower limbs" className="w-full p-2.5 text-xs border-2 border-slate-100 rounded-lg outline-none focus:border-blue-400" value={pittingLocation} onChange={(e) => setPittingLocation(e.target.value)} /></section>
                   <button onClick={() => { const gradeStr = pittingGrade ? `Grade ${pittingGrade}` : ''; const locStr = pittingLocation ? `at ${pittingLocation}` : ''; onItemClick('Physical examination', `Pitting edema: ${[gradeStr, locStr].filter(Boolean).join(' ')}`); setHoveredItem(null); resetSubStates(); }} className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-green-700 transition-all">Insert</button>
                </div>
             )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Sidebar;