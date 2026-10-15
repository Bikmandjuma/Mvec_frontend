import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import useUrlQuery from '../components/useUrlQuery';
import DeliveryTracking from '../components/DeliveryTracking';
import NotificationPanel from '../components/NotificationPanel';
import { productsApi } from '../API/products';
import { categoriesApi } from '../API/categories';
import { uploadsApi } from '../API/uploads';
import { storesApi } from '../API/stores';
import { ordersApi } from '../API/orders';
import { extractErrorMessage } from '../API/client';
import { useAuth } from '../context/AuthContext';
import { STAFF_ROLE_LABEL } from '../data/staffAccess';
import { money, matches, personName, sellerNextStatuses, StatusPill, titleCase, FormModal } from './seller/shared';
import StorePage from './seller/StorePage';
import SettingsPage from './seller/SettingsPage';
import TeamPage from './seller/TeamPage';
import PromotionsPage from './seller/PromotionsPage';
import ShippingPage from './seller/ShippingPage';
import ReviewsPage from './seller/ReviewsPage';
import { AnalyticsPage, ReportsPage } from './seller/InsightsPages';
import { PayoutsPage, TransactionsPage } from './seller/FinancePages';
import CustomersPage from './seller/CustomersPage';
import CategoriesPage, { buildCategoryTree } from './seller/CategoriesPage';
import InventoryPage from './seller/InventoryPage';
import OrdersPage from './seller/OrdersPage';
import ManualOrderModal from './seller/ManualOrderModal';
import { AdvertisementsPage, SubscriptionPage } from './seller/GrowthPages';

function Metric({label,value,icon,sub}){return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>}

const greeting=()=>{const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening';};

function SellerOverview(){
  const {user}=useAuth();
  const [products,setProducts]=useState([]);
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let alive=true;
    Promise.allSettled([productsApi.getVendorProducts(), ordersApi.getVendorOrders()]).then(([pRes,oRes])=>{
      if(!alive) return;
      if(pRes.status==='fulfilled') setProducts(pRes.value.products||[]);
      if(oRes.status==='fulfilled') setOrders((oRes.value.orders||[]).slice(0,5));
    }).finally(()=>alive&&setLoading(false));
    return ()=>{alive=false};
  },[]);

  const lowStock=products.filter(p=>Number(p.stockQuantity)<=Number(p.lowStockThreshold||5));

  return <>
    <div className="dash-page-head"><div><span className="eyebrow">SELLER PLATFORM</span><h1>{greeting()}, {user?.fullName?.split(' ')[0]||'Seller'}</h1><p>{user?.isStaff?`You're working in ${user.staffStoreName||'the store'} as ${STAFF_ROLE_LABEL[user.staffRole]||'staff'}. Menus show what your role can access.`:'Everything you need to operate your MVEC store.'}</p></div></div>
    <div className="metric-grid">
      <Metric label="Products" value={loading?'...':products.length} icon="box" sub="Published catalog"/>
      <Metric label="Low-stock items" value={loading?'...':lowStock.length} icon="bell" sub="Needs attention"/>
      <Metric label="Recent orders" value={loading?'...':orders.length} icon="cart" sub="Latest activity"/>
    </div>
    <div className="dash-grid">
      <div className="data-card"><div className="data-card-head"><div><h3>Inventory alerts</h3><span>Reorder soon</span></div><Link to="/vendor/inventory">View all</Link></div>
        {!loading && lowStock.length===0 && <p className="tiny">No low-stock items right now.</p>}
        {lowStock.slice(0,6).map(p=><div className="activity-row" key={p.id}><div><b>{p.name}</b><small>{p.stockQuantity} units remaining</small></div><em className="status warning">Low stock</em></div>)}
      </div>
      <div className="data-card"><div className="data-card-head"><div><h3>Recent orders</h3><span>Latest customer activity</span></div><Link to="/vendor/orders">View all</Link></div>
        {!loading && orders.length===0 && <p className="tiny">No orders yet.</p>}
        {orders.map(o=><Link className="activity-row" to={`/vendor/orders/${o._id}`} key={o._id}><div><b>{o.orderNumber}</b><small>{personName(o.user)}</small></div><div><strong>{money(o.vendorSubtotal)}</strong><StatusPill value={o.orderStatus}/></div></Link>)}
      </div>
    </div>
  </>;
}

// Sale price for a discount given as a percentage or a fixed RWF amount.
// Mirrors the backend calculation in models/Product.js.
const salePrice=(price,type,value)=>{
  const p=Number(price),v=Number(value);
  if(!type||!(p>0)||!(v>0)) return null;
  return Math.max(1,Math.round(p-(type==='PERCENT'?p*v/100:v)));
};
const discountError=(price,type,value)=>{
  if(!type) return '';
  const p=Number(price),v=Number(value);
  if(value===''||!(v>0)) return 'Enter a discount greater than 0.';
  if(type==='PERCENT'&&v>=100) return 'A percentage discount must be less than 100%.';
  if(type==='FIXED'&&p>0&&v>=p) return 'The discount amount must be less than the selling price.';
  return '';
};

const emptyProduct={name:'',sku:'',categoryId:'',brand:'',shortDescription:'',description:'',price:'',discountType:'',discountValue:'',costPrice:'',stockQuantity:'',lowStockThreshold:5,status:'DRAFT',mainImage:'',gallery:[],color:'',size:'',material:'',weight:'',capacity:'',model:''};

function ProductForm({product,stores=[],onSave,onCancel,saving}){
  const [form,setForm]=useState(()=>{
    if(!product) return {...emptyProduct};
    return {
      ...emptyProduct,...product,
      categoryId: product.category?.id || product.categoryId || '',
      storeId: product.store?._id || product.store || '',
      gallery: Array.isArray(product.gallery)?product.gallery:[],
      ...(product.discountType
        ? {discountType:product.discountType,discountValue:product.discountValue??''}
        : product.discountPrice&&product.discountPrice<product.price
          ? {discountType:'FIXED',discountValue:product.price-product.discountPrice}
          : {discountType:'',discountValue:''}),
    };
  });
  const [categories,setCategories]=useState([]);
  const [creatingCategory,setCreatingCategory]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{ categoriesApi.getAll().then(res=>setCategories(res.categories||[])).catch(()=>{}); },[]);

  const update=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const NEW_CATEGORY='__new__';
  const changeCategory=e=>{
    if(e.target.value===NEW_CATEGORY){ setCreatingCategory(true); return; }
    update(e);
  };
  // Creates the category, adds it to the list and selects it for this product.
  const createCategory=async({name,parentId})=>{
    const res=await categoriesApi.create({name,parentId:parentId||null});
    const created={parentId:parentId||null,...res.category,id:res.category.id||res.category._id};
    setCategories(c=>c.some(x=>x.id===created.id)?c:[...c,created]);
    setForm(f=>({...f,categoryId:created.id}));
    setNotice(res.alreadyExisted?res.message:`Category “${created.name}” created and selected.`);
    setCreatingCategory(false);
  };
  const [uploading,setUploading]=useState(false);
  const addImages=async(e)=>{
    const files=[...e.target.files||[]];
    e.target.value='';
    if(!files.length) return;
    setUploading(true);
    setError('');
    try{
      const res=await uploadsApi.uploadImages(files);
      const urls=res.urls||[];
      setForm(f=>({...f,mainImage:f.mainImage||urls[0]||'',gallery:[...f.gallery,...urls]}));
    }catch(err){ setError(extractErrorMessage(err)); }
    finally{ setUploading(false); }
  };
  const removeImage=i=>setForm(f=>{
    const nextGallery=f.gallery.filter((_,x)=>x!==i);
    return {...f,gallery:nextGallery,mainImage:nextGallery[0]||''};
  });

  const submit=e=>{
    e.preventDefault();
    setError('');
    if(!form.name||!form.categoryId||form.price===''||form.stockQuantity===''||!form.mainImage){
      setError('Please complete the required fields and add at least one image.');
      return;
    }
    const discountProblem=discountError(form.price,form.discountType,form.discountValue);
    if(discountProblem){ setError(discountProblem); return; }
    const {store:_populatedStore,discountPrice:_derived,...rest}=form;
    onSave({
      ...rest,
      storeId:form.storeId||'',
      price:Number(form.price),
      // The backend derives discountPrice from these two fields.
      discountType:form.discountType||null,
      discountValue:form.discountType?Number(form.discountValue):null,
      ...(form.discountType?{}:{discountPrice:null}),
      costPrice:form.costPrice===''?null:Number(form.costPrice),
      stockQuantity:Number(form.stockQuantity),
      lowStockThreshold:Number(form.lowStockThreshold||5),
    });
  };

  return <div className="product-editor"><div className="editor-head"><div><span className="eyebrow">PRODUCT CATALOG</span><h2>{product?'Edit product':'Add product'}</h2><p>Complete product information before publishing it to the MVEC marketplace.</p></div><button className="outline-btn" type="button" onClick={onCancel}>Cancel</button></div>
    {error&&<div className="form-error">{error}</div>}
    {notice&&<div className="form-alert success">{notice}</div>}
    <form onSubmit={submit} className="product-form">
      <section className="editor-section"><h3>Basic information</h3>
        <div className="two-col"><label className="field"><span>Product name *</span><input name="name" value={form.name} onChange={update} required placeholder="e.g. Samsung Galaxy S25"/></label><label className="field"><span>SKU</span><input name="sku" value={form.sku||''} onChange={update} placeholder="Auto-generated if left blank"/></label></div>
        <div className="two-col"><label className="field"><span>Category *</span><select name="categoryId" value={form.categoryId} onChange={changeCategory} required><option value="">Select category</option>{buildCategoryTree(categories).map(root=>root.children.length?<optgroup key={root.id} label={root.name}><option value={root.id}>{root.name} (general)</option>{root.children.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}</optgroup>:<option key={root.id} value={root.id}>{root.name}</option>)}<option disabled>──────────</option><option value={NEW_CATEGORY}>+ Create new category…</option></select></label><label className="field"><span>Brand</span><input name="brand" value={form.brand||''} onChange={update} placeholder="Brand name"/></label></div>
        {stores.length>1&&<label className="field"><span>Store</span><select name="storeId" value={form.storeId||stores.find(st=>st.isPrimary)?._id||''} onChange={update}>{stores.map(st=><option key={st._id} value={st._id}>{st.storeName}{st.isPrimary?' (primary)':''}</option>)}</select></label>}
        <label className="field"><span>Short description</span><input name="shortDescription" value={form.shortDescription||''} onChange={update} maxLength="180" placeholder="A short summary shown on product cards"/></label>
        <label className="field"><span>Description *</span><textarea name="description" value={form.description||''} onChange={update} rows="5" required placeholder="Describe the product, benefits and important information"/></label>
      </section>
      <section className="editor-section"><h3>Pricing & inventory</h3>
        <div className="three-col"><label className="field"><span>Selling price (RWF) *</span><input type="number" min="0" name="price" value={form.price} onChange={update} required/></label><label className="field"><span>Discount</span>
          <div className="seller-discount">
            <select name="discountType" value={form.discountType} onChange={e=>setForm(f=>({...f,discountType:e.target.value,discountValue:e.target.value?f.discountValue:''}))} aria-label="Discount type">
              <option value="">No discount</option><option value="PERCENT">Percent %</option><option value="FIXED">Amount RWF</option>
            </select>
            <input type="number" min="0" max={form.discountType==='PERCENT'?99:undefined} step={form.discountType==='PERCENT'?'0.1':'1'} name="discountValue" value={form.discountValue} onChange={update} disabled={!form.discountType} placeholder={form.discountType==='PERCENT'?'e.g. 15':form.discountType==='FIXED'?'e.g. 5000':'—'} aria-label="Discount value"/>
          </div>
          {form.discountType&&(()=>{const err=discountError(form.price,form.discountType,form.discountValue);const sale=salePrice(form.price,form.discountType,form.discountValue);return err&&form.discountValue!==''?<small className="seller-discount-hint error">{err}</small>:sale?<small className="seller-discount-hint">Sale price <b>{money(sale)}</b> · buyers save {money(Number(form.price)-sale)}</small>:null;})()}
        </label><label className="field"><span>Cost price</span><input type="number" min="0" name="costPrice" value={form.costPrice||''} onChange={update}/></label></div>
        <div className="three-col"><label className="field"><span>Stock quantity *</span><input type="number" min="0" name="stockQuantity" value={form.stockQuantity} onChange={update} required/></label><label className="field"><span>Low stock threshold</span><input type="number" min="0" name="lowStockThreshold" value={form.lowStockThreshold} onChange={update}/></label><label className="field"><span>Status</span><select name="status" value={form.status} onChange={update}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
      </section>
      <section className="editor-section"><h3>Product attributes</h3>
        <div className="three-col">{[['color','Color'],['size','Size'],['material','Material'],['weight','Weight'],['capacity','Capacity'],['model','Model']].map(([name,label])=><label className="field" key={name}><span>{label}</span><input name={name} value={form[name]||''} onChange={update} placeholder={label}/></label>)}</div>
      </section>
      <section className="editor-section"><h3>Media</h3><p className="editor-help">Upload product images. The first image becomes the main product image.</p>
        <label className="upload-zone"><Icon name="box"/><b>{uploading?'Uploading…':'Upload product images'}</b><small>PNG, JPG or WEBP, multiple files supported (max 8MB each)</small><input type="file" accept="image/*" multiple onChange={addImages} disabled={uploading}/></label>
        {form.gallery.length>0&&<div className="media-grid">{form.gallery.map((src,i)=><div className="media-thumb" key={i}><img src={src} alt={`Product ${i+1}`}/><button type="button" onClick={()=>removeImage(i)}>×</button>{i===0&&<span>Main image</span>}</div>)}</div>}
      </section>
      <div className="editor-actions"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" type="submit" disabled={saving||uploading}>{saving?'Saving...':product?'Save changes':'Create product'}</button></div>
    </form>
    {creatingCategory&&<FormModal stacked title="New category" subtitle="It's added to the marketplace and selected for this product."
      fields={[
        {name:'name',label:'Category name',required:true,placeholder:'e.g. Smartphones'},
        {name:'parentId',label:'Parent category',type:'select',placeholder:'None (top-level category)',options:buildCategoryTree(categories).map(r=>[r.id,r.name])},
      ]}
      initial={{name:'',parentId:''}} submitLabel="Create & select" onClose={()=>setCreatingCategory(false)} onSubmit={createCategory}/>}
  </div>;
}

function ProductModule(){
  const location=useLocation();
  const navigate=useNavigate();
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(null);
  const [saving,setSaving]=useState(false);
  const [page,setPage]=useState(1);
  const [q,setQ]=useState('');
  useUrlQuery(setQ);
  const [statusFilter,setStatusFilter]=useState('');
  const [storeFilter,setStoreFilter]=useState('');
  const [categoryFilter,setCategoryFilter]=useState(()=>new URLSearchParams(location.search).get('category')||'');
  const [allCategories,setAllCategories]=useState([]);
  const [stores,setStores]=useState([]);
  const per=6;
  useEffect(()=>{ storesApi.getMyStores().then(res=>setStores(res.stores||[])).catch(()=>{}); },[]);
  useEffect(()=>{ categoriesApi.getAll().then(res=>setAllCategories(res.categories||[])).catch(()=>{}); },[]);
  // A parent category also matches products in its subcategories.
  const categoryIds=useMemo(()=>{
    if(!categoryFilter) return null;
    return new Set([categoryFilter,...allCategories.filter(c=>String(c.parentId||'')===categoryFilter).map(c=>c.id)]);
  },[categoryFilter,allCategories]);
  const categoryOptions=useMemo(()=>{
    const used=new Set(rows.map(p=>p.category?.id||p.category?._id).filter(Boolean));
    return buildCategoryTree(allCategories).filter(r=>used.has(r.id)||r.children.some(ch=>used.has(ch.id)));
  },[rows,allCategories]);
  const primaryId=stores.find(st=>st.isPrimary)?._id;
  const storeIdOf=p=>p.store?._id||p.store||primaryId||'';
  const storeName=p=>p.store?.storeName||stores.find(st=>st._id===storeIdOf(p))?.storeName||'';

  const load=()=>{
    setLoading(true);
    productsApi.getVendorProducts()
      .then(res=>setRows(res.products||[]))
      .catch(err=>setError(extractErrorMessage(err)))
      .finally(()=>setLoading(false));
  };
  useEffect(load,[]);

  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.get('add')==='1'){ setEditing({mode:'create'}); navigate('/vendor/products',{replace:true}); }
  },[location.search,navigate]);

  useEffect(()=>{
    if(!editing) return;
    const onKeyDown=e=>{if(e.key==='Escape') setEditing(null);};
    document.addEventListener('keydown',onKeyDown);
    return()=>document.removeEventListener('keydown',onKeyDown);
  },[editing]);

  const filtered=useMemo(()=>rows.filter(p=>matches(q,p.name,p.sku,p.brand,p.category?.name)&&(!statusFilter||p.status===statusFilter)&&(!storeFilter||storeIdOf(p)===storeFilter)&&(!categoryIds||categoryIds.has(p.category?.id||p.category?._id))),[rows,q,statusFilter,storeFilter,primaryId,categoryIds]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/per));
  const current=Math.min(page,totalPages);
  const shown=filtered.slice((current-1)*per,current*per);

  const closeEditor=()=>{
    setEditing(null);
    if(new URLSearchParams(location.search).get('add')==='1') navigate('/vendor/products',{replace:true});
  };

  const saveProduct=async(payload)=>{
    setSaving(true);
    setError('');
    try{
      if(editing?.mode==='create') await productsApi.create(payload);
      else await productsApi.update(editing.product.id,payload);
      setEditing(null);
      load();
      navigate('/vendor/products',{replace:true});
    }catch(err){ setError(extractErrorMessage(err)); }
    finally{ setSaving(false); }
  };

  const toggleArchive=async(p)=>{
    try{
      await productsApi.update(p.id,{status:p.status==='INACTIVE'?'ACTIVE':'INACTIVE'});
      load();
    }catch(err){ setError(extractErrorMessage(err)); }
  };

  const removeProduct=async(p)=>{
    if(!window.confirm(`Delete ${p.name}?`)) return;
    try{ await productsApi.delete(p.id); load(); }
    catch(err){ setError(extractErrorMessage(err)); }
  };

  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">SELLER PLATFORM</span><h1>Products</h1><p>Manage product details, pricing, stock, media and publishing status.</p></div>
      <button type="button" className="gradient-btn" onClick={()=>setEditing({mode:'create'})}><Icon name="plus"/> Add product</button>
    </div>
    {error&&<div className="form-error">{error}</div>}
    <div className="dash-toolbar">
      <div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search products, SKU, brand or category"/></div>
      <select className="table-filter-select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="">All statuses</option>{[...new Set(rows.map(p=>p.status).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select>
      <select className="table-filter-select" value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setPage(1)}} aria-label="Filter by category"><option value="">All categories</option>{categoryOptions.map(r=><optgroup key={r.id} label={r.name}><option value={r.id}>All {r.name}</option>{r.children.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}</optgroup>)}{categoryFilter&&!categoryOptions.some(r=>r.id===categoryFilter||r.children.some(ch=>ch.id===categoryFilter))&&<option value={categoryFilter}>{allCategories.find(c=>c.id===categoryFilter)?.name||'Selected category'}</option>}</select>
      {stores.length>1&&<select className="table-filter-select" value={storeFilter} onChange={e=>{setStoreFilter(e.target.value);setPage(1)}} aria-label="Filter by store"><option value="">All stores</option>{stores.map(st=><option key={st._id} value={st._id}>{st.storeName}</option>)}</select>}
    </div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>Product catalog</h3><span>{filtered.length} products</span></div><span className="muted">Create, edit, archive, delete</span></div>
      {loading && <div className="empty-state"><h3>Loading products…</h3></div>}
      {!loading && shown.length===0 && <div className="empty-state"><h3>No products yet</h3><p>Add your first product to start selling.</p></div>}
      {!loading && <div className="product-admin-list">
        {shown.map(p=><div className="product-admin-row" key={p.id}>
          <div className="admin-product-main">{p.mainImage?<img src={p.mainImage} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}<div><b>{p.name}</b><small>{p.sku} · {p.brand||'No brand'} · {p.category?.name||''}{stores.length>1&&storeName(p)?` · ${storeName(p)}`:''}</small></div></div>
          <div>{p.discountPrice&&p.discountPrice<p.price?<><b>{money(p.discountPrice)}</b><small><s>{money(p.price)}</s> <em className="seller-discount-badge">{p.discountType==='PERCENT'?`-${p.discountValue}%`:`-${money(p.price-p.discountPrice)}`}</em></small></>:<b>{money(p.price)}</b>}<small>Stock: {p.stockQuantity}</small></div>
          <em className={'status '+(p.status==='ACTIVE'?'active':'warning')}>{p.status}</em>
          <div className="row-actions"><button type="button" title="Edit product" onClick={()=>setEditing({mode:'edit',product:p})}><Icon name="edit"/></button><button type="button" title={p.status==='INACTIVE'?'Restore product':'Archive product'} onClick={()=>toggleArchive(p)}><Icon name={p.status==='INACTIVE'?'check':'box'}/></button><button type="button" title="Delete product" onClick={()=>removeProduct(p)}><Icon name="trash"/></button></div>
        </div>)}
      </div>}
      <Pagination page={current} setPage={setPage} total={filtered.length} perPage={per}/>
    </div>
    {editing&&typeof document!=='undefined'&&createPortal(
      <div className="product-editor-backdrop" role="dialog" aria-modal="true" aria-label={editing.mode==='create'?'Add product':'Edit product'} onMouseDown={e=>{if(e.target===e.currentTarget) closeEditor();}}>
        <div className="product-editor-modal" onMouseDown={e=>e.stopPropagation()}>
          <ProductForm product={editing.mode==='edit'?editing.product:null} stores={stores} onCancel={closeEditor} onSave={saveProduct} saving={saving}/>
        </div>
      </div>,
      document.body
    )}
  </>;
}

const SELLER_PAGES={
  stores:StorePage, categories:CategoriesPage, customers:CustomersPage, analytics:AnalyticsPage, reports:ReportsPage,
  transactions:TransactionsPage, promotions:PromotionsPage, shipping:ShippingPage, reviews:ReviewsPage,
  team:TeamPage, settings:SettingsPage, advertisements:AdvertisementsPage, subscription:SubscriptionPage,
  products:ProductModule, inventory:InventoryPage, orders:OrdersPage, payouts:PayoutsPage,
};

export default function VendorDashboard(){
  const section=useLocation().pathname.split('/')[2]||'';
  if(section==='delivery')return <DashboardLayout><DeliveryTracking role="vendor"/></DashboardLayout>;
  if(section==='notifications')return <DashboardLayout><NotificationPanel/></DashboardLayout>;
  const Page=SELLER_PAGES[section];
  if(!section||!Page)return <DashboardLayout><SellerOverview/></DashboardLayout>;
  return <DashboardLayout><Page/></DashboardLayout>;
}
