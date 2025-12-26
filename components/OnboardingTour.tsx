
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TourStep {
  targetId?: string; // If undefined, it's a centered modal (Phase 0)
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right'; // Preferred position
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps: TourStep[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onComplete,
  steps,
  currentStep,
  setCurrentStep
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Update window size on resize
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate Target Position & Scroll
  useLayoutEffect(() => {
    if (!isOpen) return;

    const step = steps[currentStep];
    if (step.targetId) {
      const element = document.getElementById(step.targetId);
      if (element) {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Wait a bit for scroll to finish (or update immediately)
        const updateRect = () => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        };
        
        updateRect();
        // Polling briefly to catch animations/scrolls
        const interval = setInterval(updateRect, 100);
        setTimeout(() => clearInterval(interval), 1000);
      } else {
        setTargetRect(null); 
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isOpen, steps]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isModal = !step.targetId || !targetRect;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // SVG Path for Spotlight (Hollow rectangle)
  const spotlightPath = targetRect 
    ? `M0,0 H${windowSize.width} V${windowSize.height} H0 Z M${targetRect.left},${targetRect.top} h${targetRect.width} v${targetRect.height} h-${targetRect.width} Z`
    : `M0,0 H${windowSize.width} V${windowSize.height} H0 Z`; // Full cover if modal

  // Calculate Tooltip Position with Viewport Clamping
  const getTooltipStyle = () => {
    if (isModal) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '500px',
        width: '90%'
      };
    }

    if (!targetRect) return {};

    const gap = 12;
    const padding = 16; // Minimum distance from screen edge
    const tooltipWidth = 320; 
    const estimatedHeight = 220; // Used for calculating boundary collisions (approximated)

    // 1. Determine Position Strategy
    const spaceRight = windowSize.width - targetRect.right;
    const spaceLeft = targetRect.left;
    const spaceBottom = windowSize.height - targetRect.bottom;
    const spaceTop = targetRect.top;

    let pos = step.position || 'right';
    
    // Logic: If prefer right but no space, try left. If no horizontal space, try bottom.
    if (pos === 'right' && spaceRight < (tooltipWidth + padding)) pos = 'left';
    if (pos === 'left' && spaceLeft < (tooltipWidth + padding)) pos = 'right';
    
    // If still squeezed horizontally, switch to vertical
    if ((pos === 'left' || pos === 'right') && (spaceLeft < 340 && spaceRight < 340)) {
        pos = 'bottom';
    }

    if (pos === 'bottom' && spaceBottom < estimatedHeight) pos = 'top';
    if (pos === 'top' && spaceTop < estimatedHeight) pos = 'bottom';

    // 2. Calculate Coordinates
    const style: React.CSSProperties = { position: 'absolute', width: tooltipWidth };

    if (pos === 'right') {
        style.left = targetRect.right + gap;
        // Vertically center
        let top = targetRect.top + (targetRect.height / 2) - (estimatedHeight / 2);
        // Clamp vertical
        top = Math.max(padding, Math.min(top, windowSize.height - estimatedHeight - padding));
        style.top = top;
    } else if (pos === 'left') {
        style.left = targetRect.left - tooltipWidth - gap;
        let top = targetRect.top + (targetRect.height / 2) - (estimatedHeight / 2);
        top = Math.max(padding, Math.min(top, windowSize.height - estimatedHeight - padding));
        style.top = top;
    } else if (pos === 'bottom') {
        style.top = targetRect.bottom + gap;
        // Horizontally center
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        // Clamp horizontal
        left = Math.max(padding, Math.min(left, windowSize.width - tooltipWidth - padding));
        style.left = left;
    } else if (pos === 'top') {
        // Use 'bottom' prop to anchor it upwards from the target's top
        style.bottom = windowSize.height - targetRect.top + gap;
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        left = Math.max(padding, Math.min(left, windowSize.width - tooltipWidth - padding));
        style.left = left;
    }

    return style;
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden pointer-events-auto">
      {/* Backdrop with Hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <path 
          d={spotlightPath} 
          fillRule="evenodd" 
          fill="rgba(0, 0, 0, 0.65)" 
        />
      </svg>
      
      {/* Invisible blocker over the hole to prevent clicks on the app */}
      {targetRect && (
        <div 
          style={{
            position: 'absolute',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            cursor: 'default' 
          }}
          onClick={(e) => e.stopPropagation()} // Swallow clicks
        />
      )}

      {/* Tooltip Card */}
      <div 
        className="absolute bg-white rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300 border border-slate-100"
        style={getTooltipStyle() as React.CSSProperties}
      >
        {/* Header */}
        <div className={`p-5 ${isModal ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-slate-50 border-b border-slate-100'} rounded-t-xl`}>
            <div className="flex justify-between items-start">
                <h3 className={`font-bold text-lg ${isModal ? 'text-white' : 'text-slate-800'}`}>{step.title}</h3>
                {!isModal && (
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
            {isModal && <div className="mt-2 text-blue-100 text-sm opacity-90">互動式導覽教學</div>}
        </div>

        {/* Content */}
        <div className="p-5 text-slate-600 text-sm leading-relaxed whitespace-pre-line">
            {step.content}
        </div>

        {/* Footer / Controls */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <div className="text-xs text-slate-400 font-bold">
                {currentStep + 1} / {steps.length}
            </div>
            <div className="flex space-x-2">
                {!isModal && currentStep > 0 && (
                    <button 
                        onClick={handlePrev}
                        className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        上一步
                    </button>
                )}
                <button 
                    onClick={handleNext}
                    className={`px-5 py-1.5 text-sm font-bold text-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center ${isLastStep ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isLastStep ? '結束導覽' : (isModal ? '開始導覽' : '下一步')}
                    {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
                </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;
