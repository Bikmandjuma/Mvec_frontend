import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import ProductImage from "../ProductImage";
import { categoriesApi } from "../../API/categories";
import { uploadsApi } from "../../API/uploads";
import { extractErrorMessage } from "../../API/client";

let idCounter = 0;
const nextId = () => `product-image-${Date.now()}-${idCounter++}`;

const STATUS_OPTIONS = [
  ["DRAFT", "Draft"],
  ["PENDING_APPROVAL", "Pending approval"],
  ["ACTIVE", "Active"],
  ["OUT_OF_STOCK", "Out of stock"],
];

export const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const generateSku = (brand = "", name = "") => {
  const clean = (value, fallback) => {
    const letters = String(value || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return (letters + fallback).slice(0, 3).padEnd(3, "X");
  };
  const brandPart = clean(brand, "GEN");
  const namePart = clean(name, "PRD");
  const random = String(Math.floor(1000 + Math.random() * 9000));
  return `${brandPart}-${namePart}-${random}`;
};

const withCategoryId = (category) => ({
  ...category,
  id: category.id || category._id || "",
});

const emptyForm = {
  name: "",
  sku: "",
  slug: "",
  categoryId: "",
  brand: "",
  shortDescription: "",
  description: "",
  price: "",
  costPrice: "",
  stockQuantity: "",
  lowStockThreshold: 5,
  status: "DRAFT",
  discountType: "fixed",
  discountValue: "",
  color: "",
  size: "",
  material: "",
  weight: "",
  capacity: "",
  model: "",
};

const buildInitialForm = (product) => {
  if (!product) return { ...emptyForm };
  const price = product.price ?? "";
  const discount = product.discount || {};
  let discountType = discount.type === "percent" ? "percent" : "fixed";
  let discountValue = discount.value ?? "";
  if (
    discountValue === "" &&
    product.discountPrice != null &&
    Number(product.discountPrice) > 0 &&
    Number(product.discountPrice) < Number(price)
  ) {
    discountType = "fixed";
    discountValue = Math.max(0, Number(price) - Number(product.discountPrice));
  }
  return {
    ...emptyForm,
    name: product.name || "",
    sku: product.sku || "",
    slug: product.slug || "",
    categoryId:
      product.category?.id ||
      product.category?._id ||
      product.categoryId ||
      (typeof product.category === "string" ? product.category : "") ||
      "",
    brand: product.brand || "",
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    price,
    costPrice: product.costPrice ?? "",
    stockQuantity: product.stockQuantity ?? "",
    lowStockThreshold: product.lowStockThreshold ?? 5,
    status: product.status || "DRAFT",
    discountType,
    discountValue,
    color: product.attributes?.color ?? product.color ?? "",
    size: product.attributes?.size ?? product.size ?? "",
    material: product.attributes?.material ?? product.material ?? "",
    weight: product.attributes?.weight ?? product.weight ?? "",
    capacity: product.attributes?.capacity ?? product.capacity ?? "",
    model: product.attributes?.model ?? product.model ?? "",
  };
};

const savedImageItems = (product) => {
  const mainValue = product?.media?.mainImage || product?.mainImage || "";
  const list = Array.isArray(product?.media?.gallery)
    ? product.media.gallery
    : Array.isArray(product?.gallery)
      ? product.gallery
      : [];
  return list
    .filter((url) => url && url !== mainValue)
    .map((url) => ({ id: nextId(), file: null, url }));
};

export default function ProductFormModal({ product, onSave, onClose, saving = false }) {
  const editing = Boolean(product);
  const [form, setForm] = useState(() => buildInitialForm(product));
  const [mainImage, setMainImage] = useState(() => {
    const value = product?.media?.mainImage || product?.mainImage || "";
    return value ? { id: nextId(), file: null, url: value } : null;
  });
  const [gallery, setGallery] = useState(() => savedImageItems(product));
  const [videos, setVideos] = useState(() =>
    Array.isArray(product?.media?.videos) ? product.media.videos.filter(Boolean) : []
  );
  const [videoInput, setVideoInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const blobUrls = useRef(new Set());

  useEffect(() => {
    categoriesApi
      .getAll()
      .then((res) => setCategories((res.categories || []).map(withCategoryId)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(
    () => () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current.clear();
    },
    []
  );

  const track = (file) => {
    const url = URL.createObjectURL(file);
    blobUrls.current.add(url);
    return url;
  };

  const release = (url) => {
    if (url && blobUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      blobUrls.current.delete(url);
    }
  };

  // Instant local preview: a file picked in the form always renders from its
  // blob URL before (and while) it is uploaded, saved items from their URL.
  const previewOf = (item) => {
    if (!item) return "";
    if (!item.file) return item.url || "";
    if (!item.preview) item.preview = track(item.file);
    return item.preview;
  };

  const update = (event) =>
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    setNotice("");
    setError("");
    try {
      const res = await categoriesApi.create({ name });
      const category = withCategoryId(res.category);
      if (!category.id) {
        throw new Error(
          "The category response did not include its ID. Refresh categories and try again."
        );
      }
      if (res.alreadyExisted) {
        setNotice(res.message || "Category already exists.");
        setCategories((current) =>
          current.some((x) => x.id === category.id) ? current : [...current, category]
        );
      } else {
        setCategories((current) => [...current, category]);
      }
      setForm((current) => ({ ...current, categoryId: category.id }));
      setNewCategory("");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const pickMainImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMainImage((current) => {
      if (current?.preview) release(current.preview);
      return { id: nextId(), file, preview: track(file) };
    });
  };

  const addGalleryImages = (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setGallery((current) => [
      ...current,
      ...files.map((file) => ({ id: nextId(), file, preview: track(file) })),
    ]);
  };

  const removeMainImage = () => {
    setMainImage((current) => {
      if (current?.preview) release(current.preview);
      return null;
    });
  };

  const removeGalleryImage = (id) => {
    setGallery((current) => {
      const item = current.find((x) => x.id === id);
      if (item?.preview) release(item.preview);
      return current.filter((x) => x.id !== id);
    });
  };

  const makeMainImage = (id) => {
    const item = gallery.find((x) => x.id === id);
    if (!item) return;
    setGallery((current) => {
      const rest = current.filter((x) => x.id !== id);
      return mainImage ? [mainImage, ...rest] : rest;
    });
    setMainImage(item);
  };

  const addVideo = () => {
    const value = videoInput.trim();
    if (!value) return;
    setVideos((current) => [...current, value]);
    setVideoInput("");
  };

  const removeVideo = (index) =>
    setVideos((current) => current.filter((_, i) => i !== index));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !form.name.trim() ||
      !form.categoryId ||
      form.price === "" ||
      form.stockQuantity === "" ||
      !form.description.trim()
    ) {
      setError("Please complete the required fields before saving.");
      return;
    }
    if (!mainImage) {
      setError("Add a main product image so buyers can see the product.");
      return;
    }

    setUploading(true);
    try {
      const pending = [mainImage, ...gallery].filter((item) => item?.file);
      if (pending.length) {
        const res = await uploadsApi.uploadImages(pending.map((item) => item.file));
        const urls = res.urls || [];
        pending.forEach((item, index) => {
          if (urls[index]) item.url = urls[index];
        });
      }

      const mainUrl = mainImage?.url;
      if (!mainUrl) {
        throw new Error("Image upload did not return a valid URL. Please try again.");
      }
      const galleryUrls = gallery.map((item) => item.url).filter(Boolean);

      const basePrice = Number(form.price) || 0;
      const discountValue =
        form.discountValue === "" ? null : Math.max(0, Number(form.discountValue));
      let discountPrice = null;
      if (discountValue && discountValue > 0) {
        discountPrice =
          form.discountType === "percent"
            ? Math.max(0, Math.round(basePrice * (1 - discountValue / 100)))
            : Math.max(0, basePrice - discountValue);
      }

      await onSave({
        ...form,
        slug: form.slug.trim() || slugify(form.name),
        sku: form.sku.trim() || generateSku(form.brand, form.name),
        price: basePrice,
        discountPrice,
        discount:
          discountValue && discountValue > 0
            ? { type: form.discountType, value: discountValue }
            : null,
        costPrice: form.costPrice === "" ? null : Number(form.costPrice),
        stockQuantity: Number(form.stockQuantity || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 5),
        attributes: {
          color: form.color,
          size: form.size,
          material: form.material,
          weight: form.weight,
          capacity: form.capacity,
          model: form.model,
        },
        media: {
          mainImage: mainUrl,
          gallery: galleryUrls,
          thumbnails: [mainUrl, ...galleryUrls].filter(Boolean),
          videos: videos.map((value) => value.trim()).filter(Boolean),
        },
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const busy = saving || uploading;
  const previewDiscountPrice =
    form.price !== "" && Number(form.discountValue) > 0
      ? form.discountType === "percent"
        ? Math.round(Number(form.price) * (1 - Number(form.discountValue) / 100))
        : Math.max(0, Number(form.price) - Number(form.discountValue))
      : null;

  const modal = (
    <div
      className="product-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit product" : "Add product"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="product-editor-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="product-editor">
          <div className="editor-head">
            <div>
              <span className="eyebrow">PRODUCT CATALOG</span>
              <h2>{editing ? "Edit product" : "Add product"}</h2>
              <p>Complete product information before publishing it to the MVEC marketplace.</p>
            </div>
            <button className="outline-btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-alert success">{notice}</div>}

          <form onSubmit={submit} className="product-form">
            <section className="editor-section">
              <h3>Basic information</h3>
              <div className="two-col">
                <label className="field">
                  <span>Product name *</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={update}
                    required
                    placeholder="e.g. Samsung Galaxy S25"
                  />
                </label>
                <label className="field">
                  <span>Brand</span>
                  <input
                    name="brand"
                    value={form.brand}
                    onChange={update}
                    placeholder="Brand name"
                  />
                </label>
              </div>
              <div className="two-col">
                <label className="field">
                  <span>Category *</span>
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={update}
                    required
                  >
                    <option value="">Select category</option>
                    {categories
                      .filter((category) => category.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Short description</span>
                  <input
                    name="shortDescription"
                    value={form.shortDescription}
                    onChange={update}
                    maxLength="180"
                    placeholder="Summary shown on product cards"
                  />
                </label>
              </div>
              <div className="inline-add-category">
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="New category name"
                />
                <button type="button" className="outline-btn" onClick={addCategory}>
                  + Add category
                </button>
              </div>
              <label className="field">
                <span>Description *</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={update}
                  rows="5"
                  required
                  placeholder="Describe the product, benefits and important information"
                />
              </label>
            </section>

            <section className="editor-section">
              <h3>Pricing &amp; inventory</h3>
              <div className="three-col">
                <label className="field">
                  <span>Selling price (RWF) *</span>
                  <input
                    type="number"
                    min="0"
                    name="price"
                    value={form.price}
                    onChange={update}
                    required
                  />
                </label>
                <label className="field">
                  <span>Cost price (RWF)</span>
                  <input
                    type="number"
                    min="0"
                    name="costPrice"
                    value={form.costPrice}
                    onChange={update}
                  />
                </label>
                <label className="field">
                  <span>Stock quantity *</span>
                  <input
                    type="number"
                    min="0"
                    name="stockQuantity"
                    value={form.stockQuantity}
                    onChange={update}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="editor-section">
              <h3>Main product image *</h3>
              <p className="editor-help">
                The main image is the primary thumbnail buyers see. It previews instantly after
                you pick a file.
              </p>
              {mainImage ? (
                <div className="media-main">
                  <div className="media-thumb media-thumb-large">
                    <ProductImage src={previewOf(mainImage)} alt={form.name || "Main product"} />
                    <button type="button" title="Remove image" onClick={removeMainImage}>
                      ×
                    </button>
                    <span>{mainImage.file ? "New upload" : "Main image"}</span>
                  </div>
                  <label className="outline-btn media-replace">
                    Replace image
                    <input type="file" accept="image/*" onChange={pickMainImage} />
                  </label>
                </div>
              ) : (
                <label className="upload-zone">
                  <Icon name="box" />
                  <b>Upload main image</b>
                  <small>PNG, JPG, WEBP or GIF · up to 8MB</small>
                  <input type="file" accept="image/*" onChange={pickMainImage} />
                </label>
              )}
            </section>

            <section className="editor-section">
              <button
                type="button"
                className="advanced-toggle"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((value) => !value)}
              >
                <span>
                  <b>Advanced product details</b>
                  <small>Slug, SKU, discount, status, gallery, videos and attributes</small>
                </span>
                <span className={`advanced-chevron${showAdvanced ? " open" : ""}`}>⌄</span>
              </button>

              {showAdvanced && (
                <div className="advanced-body">
                  <div className="three-col">
                    <label className="field">
                      <span>URL slug</span>
                      <input
                        name="slug"
                        value={form.slug}
                        onChange={update}
                        placeholder="Auto-generated from name"
                      />
                    </label>
                    <label className="field">
                      <span>SKU</span>
                      <input
                        name="sku"
                        value={form.sku}
                        onChange={update}
                        placeholder="Auto-generated if left blank"
                      />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select name="status" value={form.status} onChange={update}>
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="three-col">
                    <label className="field">
                      <span>Low stock threshold</span>
                      <input
                        type="number"
                        min="0"
                        name="lowStockThreshold"
                        value={form.lowStockThreshold}
                        onChange={update}
                      />
                    </label>
                    <label className="field">
                      <span>Discount type</span>
                      <select
                        name="discountType"
                        value={form.discountType}
                        onChange={update}
                      >
                        <option value="fixed">Fixed amount (RWF)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>
                        Discount value {form.discountType === "percent" ? "(%)" : "(RWF)"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        name="discountValue"
                        value={form.discountValue}
                        onChange={update}
                        placeholder="0"
                      />
                    </label>
                  </div>
                  {previewDiscountPrice != null && (
                    <p className="discount-preview">
                      Discounted price: <b>{previewDiscountPrice.toLocaleString()} RWF</b>
                    </p>
                  )}

                  <div className="editor-subhead">
                    <h4>Extra gallery images</h4>
                    <p className="editor-help">Shown on the product detail page.</p>
                  </div>
                  <label className="upload-zone upload-zone-compact">
                    <Icon name="box" />
                    <b>Add gallery images</b>
                    <small>Multiple files supported</small>
                    <input type="file" accept="image/*" multiple onChange={addGalleryImages} />
                  </label>
                  {gallery.length > 0 && (
                    <div className="media-grid">
                      {gallery.map((item) => (
                        <div className="media-thumb" key={item.id}>
                          <ProductImage src={previewOf(item)} alt="Gallery preview" />
                          <button type="button" onClick={() => removeGalleryImage(item.id)}>
                            ×
                          </button>
                          <button
                            type="button"
                            className="media-make-main"
                            onClick={() => makeMainImage(item.id)}
                          >
                            Set as main
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="editor-subhead">
                    <h4>Videos</h4>
                    <p className="editor-help">Add video URLs for the product.</p>
                  </div>
                  <div className="video-input-row">
                    <input
                      value={videoInput}
                      onChange={(event) => setVideoInput(event.target.value)}
                      placeholder="https://..."
                    />
                    <button type="button" className="outline-btn" onClick={addVideo}>
                      + Add video
                    </button>
                  </div>
                  {videos.length > 0 && (
                    <div className="video-row">
                      {videos.map((video, index) => (
                        <span className="video-chip" key={`${video}-${index}`}>
                          {video}
                          <button type="button" onClick={() => removeVideo(index)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="editor-subhead">
                    <h4>Product attributes</h4>
                  </div>
                  <div className="three-col">
                    {[
                      ["color", "Color"],
                      ["size", "Size"],
                      ["material", "Material"],
                      ["weight", "Weight"],
                      ["capacity", "Capacity"],
                      ["model", "Model"],
                    ].map(([name, label]) => (
                      <label className="field" key={name}>
                        <span>{label}</span>
                        <input
                          name={name}
                          value={form[name]}
                          onChange={update}
                          placeholder={label}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="editor-actions">
              <button type="button" className="outline-btn" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="gradient-btn" type="submit" disabled={busy}>
                {uploading
                  ? "Uploading images…"
                  : saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
