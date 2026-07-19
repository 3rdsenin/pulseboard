import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects.js';
import { shareApi } from '../../api/share.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Spinner.js';

interface ShareModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ projectId, isOpen, onClose }: ShareModalProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState('');

  // Fetch project settings
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: isOpen && !!projectId,
  });

  useEffect(() => {
    if (project?.settings) {
      // Populating from an async-loaded entity — a legitimate re-initialize-on-load case,
      // not state that should instead be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPublic(project.settings.isPublic === true);
    }
  }, [project]);

  const shareMutation = useMutation({
    mutationFn: (input: { isPublic: boolean }) => shareApi.createShareLink(projectId, input),
    onSuccess: (data) => {
      // Invalidate project settings query to update the UI
      projectsApi.get(projectId); // pre-fetch or query invalidation
      setCopiedText(data.url);
    },
  });

  if (!isOpen) return null;

  const currentToken = project?.settings?.shareToken;
  const appUrl = window.location.origin;
  const currentUrl = currentToken ? `${appUrl}/s/${currentToken}` : '';

  const handleSave = () => {
    shareMutation.mutate({ isPublic });
  };

  const handleCopy = () => {
    const textToCopy = copiedText || currentUrl;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background Overlay */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Trick to center content vertically */}
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal Panel */}
        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:align-middle border border-gray-100">
          <div className="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full text-center sm:mt-0 sm:text-left">
                <h3 className="text-base font-semibold leading-6 text-gray-900 mb-2">
                  Share Dashboard
                </h3>
                <p className="text-xs text-gray-500 mb-6">
                  Generate a direct link to this dashboard. Admins can configure if the link is public or restricted to project members.
                </p>

                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner size="md" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Public/Private Toggles */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700 block">Link Privacy</label>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="privacy"
                            checked={!isPublic}
                            onChange={() => setIsPublic(false)}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <div>
                            <span className="block text-xs font-semibold text-gray-800">Private Link</span>
                            <span className="block text-[10px] text-gray-400">
                              Requires users to log in. Only project members can view the dashboard.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="privacy"
                            checked={isPublic}
                            onChange={() => setIsPublic(true)}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <div>
                            <span className="block text-xs font-semibold text-gray-800">Public Link</span>
                            <span className="block text-[10px] text-gray-400">
                              No login required. Anyone with the link can view dashboard metrics.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Shared Link Output */}
                    {(copiedText || currentUrl) && (
                      <div className="pt-2">
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Shareable Link URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={copiedText || currentUrl}
                            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 font-mono text-[11px] text-gray-600 shadow-sm focus:outline-none"
                          />
                          <Button variant="secondary" size="sm" onClick={handleCopy}>
                            {copied ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-2 border-t border-gray-100">
            <Button
              type="button"
              size="sm"
              loading={shareMutation.isPending}
              onClick={handleSave}
            >
              {currentToken ? 'Update Link' : 'Generate Link'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
