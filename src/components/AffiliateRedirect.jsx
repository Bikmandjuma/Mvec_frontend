import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { affiliatesApi } from '../API/affiliates';
import Storefront from './Storefront';

export default function AffiliateRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const handleTracking = async () => {
      try {
        const result = await affiliatesApi.trackClick(code);
        if (!mounted) return;

        if (result.FraudGuardFlagged) {
          navigate('/shop', { replace: true, state: { affiliateMessage: result.reason } });
          return;
        }

        const targetProduct = result.targetProduct;
        if (targetProduct?.id) {
          navigate(`/product/${targetProduct.id}`, { replace: true });
        } else {
          const searchParams = new URLSearchParams(location.search);
          searchParams.set('ref', code);
          navigate(`/shop?${searchParams.toString()}`, { replace: true });
        }
      } catch {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('ref', code);
        navigate(`/shop?${searchParams.toString()}`, { replace: true });
      }
    };

    handleTracking();

    return () => { mounted = false; };
  }, [code, navigate, location.search]);

  return (
    <Storefront>
      <main className="detail-page">
        <div className="empty-state">
          <h3>Redirecting…</h3>
          <p>Tracking your referral link</p>
        </div>
      </main>
    </Storefront>
  );
}