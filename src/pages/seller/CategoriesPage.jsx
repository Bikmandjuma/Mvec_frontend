import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { categoriesApi } from '../../API/categories';
import { productsApi } from '../../API/products';
import { PageHead, Loading, EmptyState, Metric, FormModal, matches, useLoader, useNotice } from './shared';

const idOf = c => String(c?.id || c?._id || c || '');

// Flat category list -> [{...parent, children: [...]}], keeping API order.
export function buildCategoryTree(categories) {
  const byId = {};
  categories.forEach(c => { byId[idOf(c)] = { ...c, children: [] }; });
  const roots = [];
  categories.forEach(c => {
    const parent = c.parentId && byId[idOf(c.parentId)];
    if (parent) parent.children.push(byId[idOf(c)]);
    else roots.push(byId[idOf(c)]);
  });
  return roots;
}

export default function CategoriesPage() {
  const { data, loading, error, reload } = useLoader(() => Promise.all([
    categoriesApi.getAll({ withCounts: true }).then(r => r.categories || []),
    productsApi.getVendorProducts().then(r => r.products || []).catch(() => []),
  ]).then(([categories, products]) => ({ categories, products })));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const [adding, setAdding] = useState(null);
  const notice = useNotice();

  const view = useMemo(() => {
    if (!data) return null;
    const mine = {};
    data.products.forEach(p => { const k = idOf(p.category); mine[k] = (mine[k] || 0) + 1; });
    const known = new Set(data.categories.map(idOf));
    const orphaned = data.products.filter(p => !known.has(idOf(p.category))).length;
    const tree = buildCategoryTree(data.categories).map(root => {
      const children = root.children.map(ch => ({ ...ch, mine: mine[idOf(ch)] || 0 }));
      return {
        ...root,
        children,
        mine: (mine[idOf(root)] || 0) + children.reduce((s, ch) => s + ch.mine, 0),
        market: (root.productCount || 0) + children.reduce((s, ch) => s + (ch.productCount || 0), 0),
      };
    });
    return { tree, orphaned, usedCount: Object.keys(mine).filter(k => known.has(k)).length };
  }, [data]);

  // A parent stays visible when it or one of its subcategories matches.
  const shown = useMemo(() => {
    if (!view) return [];
    return view.tree
      .map(root => {
        const kids = root.children.filter(ch => matches(q, ch.name));
        return matches(q, root.name) ? root : kids.length ? { ...root, children: kids, forcedOpen: true } : null;
      })
      .filter(Boolean);
  }, [view, q]);

  const parentOptions = (view?.tree || []).map(r => [idOf(r), r.name]);
  const addFields = [
    { name: 'name', label: 'Category name', required: true, placeholder: 'e.g. Smartphones' },
    { name: 'parentId', label: 'Parent category', type: 'select', placeholder: 'None (top-level category)', options: parentOptions },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'Optional: what belongs in this category' },
  ];

  const productsLink = id => `/vendor/products?category=${id}`;

  return <>
    <PageHead title="Categories" desc="Marketplace categories your products can be listed in. Categories are shared across MVEC; editing and removing them is handled by MVEC admins."
      action={<button type="button" className="gradient-btn" onClick={() => setAdding({ parentId: '' })}><Icon name="plus" /> Add category</button>} />
    {notice.banner}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {view && <>
      <div className="metric-grid">
        <Metric label="Marketplace categories" value={data.categories.length} icon="tag" sub={`${view.tree.length} top-level`} />
        <Metric label="You sell in" value={view.usedCount} icon="shop" sub={`of ${data.categories.length} categories`} />
        <Metric label="Need a category" value={view.orphaned} icon="bell" sub={view.orphaned ? 'Products in a disabled category' : 'All products categorized'} />
      </div>
      <div className="dash-toolbar">
        <div className="dash-filter"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search categories and subcategories" /></div>
      </div>
      {view.tree.length === 0
        ? <EmptyState title="No categories yet" text="Add the first category for your products." />
        : <div className="data-card seller-cat-card">
          <div className="seller-cat-row seller-cat-head" aria-hidden="true">
            <span>Category</span><span>Your products</span><span>On MVEC</span><span />
          </div>
          {shown.length === 0 && <p className="tiny seller-cat-empty">No categories match “{q}”.</p>}
          {shown.map(root => {
            const id = idOf(root);
            const isOpen = root.forcedOpen || open[id];
            return <div className={'seller-cat-group' + (isOpen ? ' open' : '')} key={id}>
              <div className="seller-cat-row">
                <button type="button" className="seller-cat-name" onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))} aria-expanded={!!isOpen} disabled={!root.children.length}>
                  <Icon name="arrow" size={12} />
                  <b>{root.name}</b>
                  {root.children.length > 0 && <small>{root.children.length} sub</small>}
                </button>
                <span className={root.mine ? 'seller-cat-mine' : 'muted'}>{root.mine}</span>
                <span className="muted">{root.market}</span>
                <span className="seller-cat-actions">
                  {root.mine > 0 && <Link to={productsLink(id)} className="table-action-btn">View</Link>}
                  <button type="button" className="table-action-btn" onClick={() => setAdding({ parentId: id })} title={`Add a subcategory to ${root.name}`}>+ Sub</button>
                </span>
              </div>
              {isOpen && root.children.map(ch => <div className="seller-cat-row seller-cat-child" key={idOf(ch)}>
                <span className="seller-cat-name"><b>{ch.name}</b></span>
                <span className={ch.mine ? 'seller-cat-mine' : 'muted'}>{ch.mine}</span>
                <span className="muted">{ch.productCount || 0}</span>
                <span className="seller-cat-actions">{ch.mine > 0 && <Link to={productsLink(idOf(ch))} className="table-action-btn">View</Link>}</span>
              </div>)}
            </div>;
          })}
        </div>}
    </>}
    {adding && <FormModal title={adding.parentId ? 'Add subcategory' : 'Add category'}
      subtitle="New categories are available to every seller right away. If it already exists, the existing one is used."
      fields={addFields} initial={adding} submitLabel="Add category" onClose={() => setAdding(null)}
      onSubmit={async form => {
        const res = await categoriesApi.create({ name: form.name, parentId: form.parentId || null, description: form.description || undefined });
        setAdding(null);
        if (form.parentId) setOpen(o => ({ ...o, [form.parentId]: true }));
        notice.success(res.alreadyExisted ? res.message : `Category “${res.category?.name}” added.`);
        reload();
      }} />}
  </>;
}
