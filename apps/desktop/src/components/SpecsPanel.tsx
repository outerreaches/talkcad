import { clsx } from 'clsx';
import { useSpecsStore } from '../store';
import type { Spec } from '@talkcad/shared';

interface SpecsPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SpecsPanel({ collapsed, onToggle }: SpecsPanelProps) {
  const { specs } = useSpecsStore();

  const specList = Object.values(specs);
  const userSpecs = specList.filter((s) => s.confidence === 'explicit');
  const agentSpecs = specList.filter((s) => s.confidence !== 'explicit');

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-full h-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
        title="Show specs (⌘J)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-zinc-700">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Specs</span>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
          title="Hide specs (⌘J)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {specList.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-xs">No specs yet</p>
            <p className="text-xs mt-1 text-zinc-600">Start a conversation to see extracted specs</p>
          </div>
        ) : (
          <>
            {/* User specs */}
            {userSpecs.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-zinc-400 mb-2">YOUR SPECS</h3>
                <div className="space-y-1">
                  {userSpecs.map((spec) => (
                    <SpecItem key={spec.id} spec={spec} />
                  ))}
                </div>
              </div>
            )}

            {/* Agent defaults */}
            {agentSpecs.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 mb-2">DEFAULTS</h3>
                <div className="space-y-1">
                  {agentSpecs.map((spec) => (
                    <SpecItem key={spec.id} spec={spec} muted />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 pt-3 border-t border-zinc-700">
              <div className="flex items-center gap-1.5 text-xs">
                {userSpecs.every((s) => s.verified) ? (
                  <>
                    <span className="text-green-400">✓</span>
                    <span className="text-zinc-400">
                      {userSpecs.length}/{userSpecs.length} verified
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-yellow-400">○</span>
                    <span className="text-zinc-400">
                      {userSpecs.filter((s) => s.verified).length}/{userSpecs.length} verified
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SpecItemProps {
  spec: Spec;
  muted?: boolean;
}

function SpecItem({ spec, muted }: SpecItemProps) {
  const formatValue = (value: unknown, unit?: string): string => {
    if (typeof value === 'number') {
      return `${value}${unit || ''}`;
    }
    if (typeof value === 'boolean') {
      return value ? 'yes' : 'no';
    }
    return String(value);
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-between px-2 py-1 rounded text-xs',
        muted ? 'text-zinc-500' : 'text-zinc-300 bg-zinc-800/50'
      )}
    >
      <span className="truncate">{spec.key}</span>
      <div className="flex items-center gap-1.5">
        <span className={muted ? 'text-zinc-600' : 'text-zinc-400'}>
          {formatValue(spec.value, spec.unit)}
        </span>
        {spec.confidence === 'explicit' && (
          <span className={spec.verified ? 'text-green-400' : 'text-zinc-500'}>
            {spec.verified ? '✓' : '○'}
          </span>
        )}
      </div>
    </div>
  );
}
