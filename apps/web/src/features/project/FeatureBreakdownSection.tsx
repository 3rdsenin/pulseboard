import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboard.js';
import { shareApi } from '../../api/share.js';
import { Spinner } from '../../components/Spinner.js';

interface FeatureBreakdownSectionProps {
  projectId?: string;
  sprintId?: string;
  shareToken?: string;
}

export function FeatureBreakdownSection({ projectId, sprintId, shareToken }: FeatureBreakdownSectionProps) {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['feature-breakdown', projectId || shareToken, sprintId],
    queryFn: () =>
      shareToken
        ? shareApi.getFeatureBreakdown(shareToken, sprintId)
        : dashboardApi.getFeatureBreakdown(projectId!, sprintId),
    enabled: !!projectId || !!shareToken,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return null; // Don't show the section if no categories exist
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Feature Categories Breakdown</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const percent = Math.round(cat.completionRate * 100);
          const barColor = cat.color || '#94A3B8'; // Fallback to slate-400

          return (
            <div key={cat.id} className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="font-semibold text-gray-800">{cat.name}</span>
                </div>
                <span className="text-gray-500 font-mono">
                  {cat.done} / {cat.total} issues ({percent}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200/50">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
