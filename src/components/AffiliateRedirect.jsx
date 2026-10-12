import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { affiliatesApi } from '../API/affiliates';
import Storefront from './Storefront';

export default function AffiliateRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const handleTracking = async () => {
      try {
        const result = await affiliatesApi.trackClick(code);
        if (!mounted) return;

        if (result.data?.FraudGuardFlagged) {
          const target = result.data.targetProduct?.id;
          navigate(target ? `/product/${target}` : '/shop', { replace: true });
          return;
        }

        // Destination comes from the backend's link record, never from the URL,
        // and is always an internal storefront route.
        const targetProduct = result.data?.targetProduct;
        if (targetProduct?.id) {
          navigate(`/product/${targetProduct.id}`, { replace: true });
        } else {
          navigate('/shop', { replace: true });
        }
      } catch {
        // Unknown or terminated link: land on the shop without crediting anyone.
        if (mounted) navigate('/shop', { replace: true, state: { affiliateMessage: 'This referral link is no longer active.' } });
      }
    };

    handleTracking();

    return () => { mounted = false; };
  }, [code, navigate]);

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