import { useEffect, useMemo, useState } from 'react';
import { watchRelawan } from '../lib/relawanManagement';
import { watchPoskoResources } from '../lib/poskoResources';
import { buildPoskoOperations } from '../lib/poskoOperations';
import { useAdminRealtimeModel } from './useAdminRealtimeModel';

const initial = { status: 'loading', data: null, revision: 0 };

export function usePoskoOperations({ includeResources = true } = {}) {
  const clinical = useAdminRealtimeModel();
  const [roster, setRoster] = useState(initial);
  const [resources, setResources] = useState(initial);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    const stopRoster = watchRelawan((data) => setRoster({ status: 'ready', data }),
      () => setRoster((previous) => ({ ...previous, status: 'error' })));
    const stopResources = includeResources ? watchPoskoResources((data) => setResources((previous) => ({ status: 'ready', data, revision: previous.revision + 1 })),
      () => setResources((previous) => ({ ...previous, status: 'error' }))) : () => {};
    return () => {
      stopRoster(); stopResources();
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, [includeResources]);
  const projection = useMemo(() => buildPoskoOperations(clinical.model, roster.data, resources.data),
    [clinical.model, roster.data, resources.data]);
  const streams = includeResources ? [roster, resources] : [roster];
  const loading = clinical.loading || streams.some((stream) => stream.status === 'loading');
  const error = clinical.error || streams.some((stream) => stream.status === 'error');
  const current = online && clinical.current && streams.every((stream) =>
    stream.status === 'ready' && !stream.data.fromCache && !stream.data.pending);
  return { ...projection, clinical, roster, resources, online, loading, error, current };
}
