import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { LEVEL_CONFIG } from '../../constants';
import { EventLevels } from '../../types';

type DisasterMapControlPanelProps = {
  isOpen: boolean;
  isLargeScreen: boolean;
  minDisplayLevel: EventLevels;
  onMinDisplayLevelChange: (level: EventLevels) => void;
  windowAgeMs: number;
  onWindowAgeMsChange: (nextMs: number) => void;
  sliderMinMs: number;
  sliderStepMs: number;
  maxEventAgeMs: number;
  windowLabel: string;
  minWindowLabel: string;
  maxWindowLabel: string;
};

const MIN_LEVEL_FILTER_OPTIONS: EventLevels[] = [
  EventLevels.Info,
  EventLevels.Minor,
  EventLevels.Moderate,
  EventLevels.Severe,
  EventLevels.Critical,
];

const DisasterMapControlPanel: React.FC<DisasterMapControlPanelProps> = ({
  isOpen,
  isLargeScreen,
  minDisplayLevel,
  onMinDisplayLevelChange,
  windowAgeMs,
  onWindowAgeMsChange,
  sliderMinMs,
  sliderStepMs,
  maxEventAgeMs,
  windowLabel,
  minWindowLabel,
  maxWindowLabel,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const briefingLabel = `최근 ${windowLabel} ${LEVEL_CONFIG[minDisplayLevel].label}+ 표시 중`;
  const panelPositionClass = isLargeScreen ? 'inset-x-0' : 'right-0 w-full max-w-[440px]';

  useEffect(() => {
    if (!isOpen) {
      setIsMenuOpen(false);
    }
  }, [isOpen]);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 sm:inset-x-5 sm:bottom-5">
      <div className="relative flex justify-end">
        {isMenuOpen ? (
          <div id="map-control-panel" className={`absolute bottom-full mb-2 ${panelPositionClass}`}>
            <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/85 p-2.5 shadow-[0_16px_36px_rgba(2,6,23,0.55)] backdrop-blur md:gap-3 md:p-3">
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/35 px-2.5 py-2 md:px-3 md:py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
                  <span className="font-semibold text-slate-300">표시 시간</span>
                  <span className="font-semibold text-slate-200">최근 {windowLabel}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] md:text-xs text-slate-500 whitespace-nowrap">{minWindowLabel}</span>
                  <input
                    id="map-time-window"
                    type="range"
                    min={sliderMinMs}
                    max={maxEventAgeMs}
                    step={sliderStepMs}
                    value={windowAgeMs}
                    onChange={(event) => {
                      onWindowAgeMsChange(Number(event.target.value));
                    }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r from-slate-700 via-slate-600 to-blue-500 accent-blue-400"
                    aria-label="지도 표시 시간 범위"
                  />
                  <span className="text-[10px] md:text-xs text-slate-500 whitespace-nowrap">{maxWindowLabel}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/35 px-2.5 py-2 md:px-3 md:py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
                  <span className="font-semibold text-slate-300">최소 레벨</span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="지도 최소 레벨 선택"
                  className="mt-2 flex flex-wrap items-center gap-1"
                >
                  {MIN_LEVEL_FILTER_OPTIONS.map((level) => {
                    const isActive = level === minDisplayLevel;
                    const activeClass = `${LEVEL_CONFIG[level].bg} ${LEVEL_CONFIG[level].text} ${LEVEL_CONFIG[level].border}`;
                    return (
                      <label
                        key={level}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] md:text-xs font-semibold transition ${
                          isActive
                            ? activeClass
                            : 'border-slate-700/80 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="map-min-level"
                          value={level}
                          checked={isActive}
                          onChange={() => onMinDisplayLevelChange(level)}
                          className="sr-only"
                          aria-label={`최소 레벨: ${LEVEL_CONFIG[level].label} 이상`}
                        />
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white/80' : LEVEL_CONFIG[level].bg}`}
                        />
                        <span>{LEVEL_CONFIG[level].label}+</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-controls="map-control-panel"
          aria-label={isMenuOpen ? '설정 메뉴 숨기기' : '설정 메뉴 열기'}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/90 px-3 py-1.5 text-[11px] md:text-xs font-semibold text-slate-200 shadow-[0_12px_26px_rgba(2,6,23,0.55)] transition hover:border-slate-500 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-blue-300" />
          <span>{briefingLabel}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default DisasterMapControlPanel;
