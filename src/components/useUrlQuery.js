// Pages opened from global search arrive with ?q=…; this pre-fills their own
// search box (and follows later changes to the URL).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function useUrlQuery(apply) {
  const { search } = useLocation();
  useEffect(() => {
    const value = new URLSearchParams(search).get('q');
    if (value !== null) apply(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
