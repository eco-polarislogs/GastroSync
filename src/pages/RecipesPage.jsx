import React, { useState, useEffect } from 'react'
import { useRecipeStore, useInventoryStore, useAuthStore, useNotificationStore } from '../store'
import { FiPlus, FiEdit3, FiTrash2, FiChevronDown, FiChevronUp, FiSearch, FiFilter, FiAlertTriangle, FiX, FiCheck } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import { TRANSLATIONS, getCategoryLabel } from '../utils/translations'
import '../styles/pages.css'

export default function RecipesPage() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const currentUser = useAuthStore((s) => s.user)
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr

  const { recipes, addRecipe, updateRecipe, deleteRecipe, fetchRecipes } = useRecipeStore()
  const { items, fetchItems } = useInventoryStore()
  const { sendNotification } = useNotificationStore()

  useEffect(() => {
    if (fetchRecipes) fetchRecipes()
    if (fetchItems) fetchItems()
  }, [fetchRecipes, fetchItems])

  const [expandedId, setExpandedId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [recipeToDelete, setRecipeToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Categories list
  const categories = ['all', ...new Set(recipes.map((r) => r.category))]

  // Filtered recipes
  const filteredRecipes = recipes.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ingredients.some(ing => ing.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter
    return matchSearch && matchCat
  })

  // New recipe form state
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: 'Ana Yemek',
    salePrice: '',
    ingredients: [{ itemId: '', amount: '' }],
  })

  // Edit recipe form state
  const [editForm, setEditForm] = useState({
    id: null,
    name: '',
    category: 'Ana Yemek',
    salePrice: '',
    ingredients: [],
  })

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getFoodCostClass = (percent) => {
    if (percent >= 40) return 'danger'
    if (percent >= 30) return 'warning'
    return 'success'
  }

  const handleAddIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { itemId: '', amount: '' }],
    })
  }

  const handleAddEditIngredient = () => {
    setEditForm({
      ...editForm,
      ingredients: [...editForm.ingredients, { itemId: '', amount: '' }],
    })
  }

  const handleOpenEdit = (recipe, e) => {
    e.stopPropagation()
    setEditForm({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      salePrice: recipe.salePrice,
      ingredients: (recipe.ingredients || []).map(ing => {
        let matchedId = ing.itemId ? String(ing.itemId) : ''
        if (!matchedId || !items.some(i => String(i.id) === matchedId)) {
          const found = items.find(i => ing.name && i.name.trim().toLowerCase() === ing.name.trim().toLowerCase())
          if (found) matchedId = String(found.id)
        }
        return {
          itemId: matchedId,
          amount: ing.amount !== undefined ? String(ing.amount) : '1'
        }
      })
    })
    setEditingRecipe(recipe)
  }

  const handleUpdateRecipeSubmit = async (e) => {
    e.preventDefault()
    const ingredients = editForm.ingredients
      .filter((ing) => ing.itemId && ing.amount)
      .map((ing) => {
        const item = items.find((i) => i.id === parseInt(ing.itemId))
        const rawAmount = parseFloat(ing.amount) || 0
        const unitCost = item ? item.price : 0
        return {
          itemId: parseInt(ing.itemId),
          name: item?.name || '',
          amount: rawAmount,
          quantity: rawAmount,
          unit: item?.unit || '',
          unitCost: unitCost,
          cost: Math.round(rawAmount * unitCost * 100) / 100
        }
      })

    const cost = ingredients.reduce((sum, ing) => sum + ing.cost, 0)
    const salePrice = parseFloat(editForm.salePrice) || 0
    const foodCostPercent = salePrice > 0 ? (cost / salePrice) * 100 : 0

    const updatedData = {
      name: editForm.name,
      category: editForm.category,
      salePrice,
      ingredients,
      cost: Math.round(cost * 100) / 100,
      foodCostPercent: Math.round(foodCostPercent * 10) / 10,
    }

    await updateRecipe(editForm.id, updatedData)

    notifySuccess(`${editForm.name} başarıyla güncellendi!`, 'Reçete Güncellendi')
    setEditingRecipe(null)
  }

  const executeDeleteRecipe = async () => {
    if (!recipeToDelete) return
    setDeleting(true)

    // Backend silme isteği
    try {
      await fetch(`http://localhost:8080/api/recipes/${recipeToDelete.id}`, {
        method: 'DELETE',
      })
    } catch (_) { }

    deleteRecipe(recipeToDelete.id)
    notifySuccess(`${recipeToDelete.name} menüden kalıcı olarak silindi.`, 'Reçete Silindi')
    setRecipeToDelete(null)
    setDeleting(false)
  }

  const handleSubmitRecipe = async (e) => {
    e.preventDefault()
    const ingredients = newRecipe.ingredients
      .filter((ing) => ing.itemId && ing.amount)
      .map((ing) => {
        const item = items.find((i) => i.id === parseInt(ing.itemId))
        const rawAmount = parseFloat(ing.amount) || 0
        const unitCost = item ? item.price : 0
        return {
          itemId: parseInt(ing.itemId),
          name: item?.name || '',
          amount: rawAmount,
          quantity: rawAmount,
          unit: item?.unit || '',
          unitCost: unitCost,
          cost: Math.round(rawAmount * unitCost * 100) / 100
        }
      })

    const cost = ingredients.reduce((sum, ing) => sum + ing.cost, 0)
    const salePrice = parseFloat(newRecipe.salePrice) || 0
    const foodCostPercent = salePrice > 0 ? (cost / salePrice) * 100 : 0

    await addRecipe({
      name: newRecipe.name,
      category: newRecipe.category,
      portions: 1,
      salePrice,
      ingredients,
      cost: Math.round(cost * 100) / 100,
      foodCostPercent: Math.round(foodCostPercent * 10) / 10,
    })

    // Piyasa standardı: Şef yeni bir reçete tanımladığında Yönetici ve Kasiyere bildirim
    sendNotification({
      title: '🍽️ Yeni Menü Reçetesi Tanımlandı',
      message: `${currentUser?.name || 'Mutfak Şefi'} tarafından "${newRecipe.name}" reçetesi eklendi (Porsiyon Maliyeti: ${Math.round(cost).toLocaleString('tr-TR')} ₺, Satış: ${salePrice.toLocaleString('tr-TR')} ₺, Food Cost: %${foodCostPercent.toFixed(1)}).`,
      targetRole: 'MANAGER',
      senderName: currentUser?.name || 'Mutfak Şefi',
      type: 'RECIPE_CREATED',
      relatedEntityId: null
    })

    // Telsiz kanalına mesaj düşür
    try {
      const savedChat = localStorage.getItem('gastrosync_team_chat')
      const chatList = savedChat ? JSON.parse(savedChat) : []
      const newChatMessage = {
        id: Date.now(),
        channelId: 'kitchen',
        sender: currentUser?.name || 'Fatma Şef',
        role: 'chef',
        text: `Yeni "${newRecipe.name}" reçetesini menüye ekledim! Food Cost oranı: %${foodCostPercent.toFixed(1)}. Satışa hazır.`,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        avatar: currentUser?.avatar || 'FŞ',
        priority: 'normal'
      }
      localStorage.setItem('gastrosync_team_chat', JSON.stringify([...chatList, newChatMessage]))
    } catch (_) { }

    notifySuccess(`${newRecipe.name} başarıyla eklendi`, 'Yeni Reçete Eklendi')

    setNewRecipe({
      name: '',
      category: 'Ana Yemek',
      salePrice: '',
      ingredients: [{ itemId: '', amount: '' }],
    })
    setShowAddModal(false)
  }

  return (
    <div className="page-container">
      {/* Action Row */}
      <div className="page-header-row" style={{ justifyContent: 'flex-end', marginBottom: '-8px' }}>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <FiPlus /> {t.addNewRecipe}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t.searchRecipePlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? t.allCategories : getCategoryLabel(cat, currentLanguage)}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginLeft: 'auto' }}>
          <strong>{filteredRecipes.length}</strong> / {recipes.length} {t.recordsListed}
        </span>
      </div>

      {/* Recipe Cards */}
      <div className="recipe-grid">
        {filteredRecipes.map((recipe) => (
          <div key={recipe.id} className="recipe-card animate-fade-in">
            <div className="recipe-card-top" onClick={() => toggleExpand(recipe.id)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
              <div className="recipe-card-info" style={{ flex: '1 1 0%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span className="recipe-card-category">{getCategoryLabel(recipe.category, currentLanguage)}</span>
                  {(() => {
                    const hasLowStockIng = recipe.ingredients?.some(ing => {
                      const item = items.find(i => i.id === ing.itemId || (ing.name && i.name.toLowerCase().includes(ing.name.toLowerCase())))
                      return item && item.stock <= item.minStock
                    })
                    return hasLowStockIng ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca'
                      }}>
                        ⚠️ Kritik Malzeme
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0'
                      }}>
                        ✓ Stok Güvende (Servise Hazır)
                      </span>
                    )
                  })()}
                </div>
                <h3 className="recipe-card-name" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.35' }}>
                  {recipe.name}
                </h3>
              </div>
              <div className="recipe-card-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div
                  className={`recipe-cost-badge recipe-cost-badge--${getFoodCostClass(recipe.foodCostPercent)}`}
                  style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={`%${recipe.foodCostPercent.toFixed(1)}`}
                >
                  %{recipe.foodCostPercent > 999 ? '999+' : recipe.foodCostPercent.toFixed(1)}
                </div>
                <button
                  className="btn-icon"
                  style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => handleOpenEdit(recipe, e)}
                  title="Reçeteyi Düzenle"
                >
                  <FiEdit3 size={16} />
                </button>
                <button
                  className="btn-icon"
                  style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRecipeToDelete(recipe)
                  }}
                  title="Reçeteyi Sil"
                >
                  <FiTrash2 size={16} />
                </button>
                <span style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>
                  {expandedId === recipe.id ? <FiChevronUp /> : <FiChevronDown />}
                </span>
              </div>
            </div>

            <div className="recipe-card-stats">
              <div className="recipe-stat">
                <span className="recipe-stat-label">{t.costLabel}</span>
                <span className="recipe-stat-value">{recipe.cost.toFixed(2)} ₺</span>
              </div>
              <div className="recipe-stat">
                <span className="recipe-stat-label">{t.targetSaleTh}</span>
                <span className="recipe-stat-value recipe-stat-value--bold">{recipe.salePrice.toFixed(2)} ₺</span>
              </div>
              <div className="recipe-stat">
                <span className="recipe-stat-label">{t.profitCol}</span>
                <span className="recipe-stat-value recipe-stat-value--success">
                  {(recipe.salePrice - recipe.cost).toFixed(2)} ₺
                </span>
              </div>
            </div>

            {/* Expanded: Ingredients */}
            {expandedId === recipe.id && (
              <div className="recipe-card-expanded animate-fade-in">
                <h4 className="recipe-expanded-title">{t.ingredientsTitle} (1 Porsiyon)</h4>
                <table className="recipe-ingredients-table">
                  <thead>
                    <tr>
                      <th>{t.productNameCol}</th>
                      <th>{t.quantity}</th>
                      <th>{t.unitPriceCol}</th>
                      <th>{t.totalValueCol}</th>
                      <th>Depo Durumu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.ingredients.map((ing, idx) => {
                      const item = items.find((i) => i.id === ing.itemId || (ing.name && i.name.toLowerCase().includes(ing.name.toLowerCase())))
                      const unitCost = item ? item.price : 0
                      const isLow = item ? item.stock <= item.minStock : false
                      return (
                        <tr key={idx}>
                          <td className="td-bold">{ing.name}</td>
                          <td>{ing.amount} {ing.unit}</td>
                          <td>{unitCost.toFixed(2)} ₺/{ing.unit}</td>
                          <td className="td-bold">{(unitCost * ing.amount).toFixed(2)} ₺</td>
                          <td>
                            {item ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: isLow ? '#fee2e2' : '#ecfdf5',
                                color: isLow ? '#b91c1c' : '#047857',
                                border: `1px solid ${isLow ? '#fca5a5' : '#a7f3d0'}`
                              }}>
                                {isLow ? '⚠️ Az Kaldı' : '✓ Yeterli'} ({item.stock} {item.unit})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="recipe-card-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }}>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={(e) => handleOpenEdit(recipe, e)}
                  >
                    <FiEdit3 size={15} /> {t.editRecipeBtn}
                  </button>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#dc2626',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setRecipeToDelete(recipe)
                    }}
                    title={t.deleteRecipeBtn}
                  >
                    <FiTrash2 size={15} /> {t.deleteRecipeBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Recipe Modal - Geniş ve Kaydırma Çubuğu Olmadan Tam Açılan Görünüm */}
      {editingRecipe && (
        <div className="modal-overlay" onClick={() => setEditingRecipe(null)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              maxHeight: '94vh',
              background: '#ffffff',
              border: '1px solid #dbe7df',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(10, 31, 17, 0.18)'
            }}
          >
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ea', background: '#f8fbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <FiEdit3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>{t.editRecipeTitle}</h3>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}><strong>{editingRecipe.name}</strong> {t.editRecipeDesc}</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditingRecipe(null)} style={{ color: '#64748b' }}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleUpdateRecipeSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-field">
                <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.recipeNameLabel}</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder={t.recipeNamePlaceholder}
                  required
                />
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-field">
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.categoryLabel}</label>
                  <select
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    {['Ana Yemek', 'Salata', 'Kahvaltı', 'Tatlı', 'İçecek', 'Başlangıç', 'Yan Ürün', 'Pizza & Fırın', 'Deniz Ürünleri'].map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {getCategoryLabel(catKey, currentLanguage)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.salePriceLabel}</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                    value={editForm.salePrice}
                    onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                    placeholder="350"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.ingredientListGrammage}</label>
                  <button
                    type="button"
                    onClick={handleAddEditIngredient}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <FiPlus /> {t.addNewIngredientRow}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fbf9', padding: '12px', borderRadius: '10px', border: '1px solid #e8f0ea' }}>
                  {editForm.ingredients.map((ing, idx) => (
                    <div key={idx} className="form-row ingredient-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: 0 }}>
                      <select
                        className="form-input"
                        style={{ flex: 3, background: '#ffffff', border: '1px solid #cbd5e1' }}
                        value={ing.itemId}
                        onChange={(e) => {
                          const updated = [...editForm.ingredients]
                          updated[idx].itemId = e.target.value
                          setEditForm({ ...editForm, ingredients: updated })
                        }}
                      >
                        <option value="">Malzeme seçin...</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.unit} — {item.price} ₺)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="form-input"
                        style={{ flex: 1.2, background: '#ffffff', border: '1px solid #cbd5e1' }}
                        placeholder="Miktar"
                        value={ing.amount}
                        onChange={(e) => {
                          const updated = [...editForm.ingredients]
                          updated[idx].amount = e.target.value
                          setEditForm({ ...editForm, ingredients: updated })
                        }}
                        min="0"
                        step="0.001"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editForm.ingredients.filter((_, i) => i !== idx)
                          setEditForm({ ...editForm, ingredients: updated })
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Malzemeyi Çıkar"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditingRecipe(null)}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0a1f11 0%, #163e23 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(10, 31, 17, 0.25)'
                  }}
                >
                  {t.saveChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation MessageBox Modal - GastroSync Temasına Tam Uyumlu */}
      {recipeToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setRecipeToDelete(null)} style={{ background: 'rgba(7, 25, 14, 0.65)', backdropFilter: 'blur(5px)', zIndex: 1100 }}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              background: '#ffffff',
              border: '1px solid #fee2e2',
              boxShadow: '0 25px 50px -12px rgba(10, 31, 17, 0.25), 0 0 20px rgba(239, 68, 68, 0.1)',
              borderRadius: '20px',
              padding: '28px',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fef2f2',
                border: '2px solid #fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                boxShadow: '0 8px 16px rgba(239, 68, 68, 0.15)'
              }}>
                <FiAlertTriangle size={32} />
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#0f172a', fontWeight: '800' }}>
                  Reçeteyi Kalıcı Olarak Sil?
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                  <strong style={{ color: '#0f172a' }}>"{recipeToDelete.name}"</strong> reçetesi menüden ve sistem veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz. Onaylıyor musunuz?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #dbe7df',
                    color: '#334155',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setRecipeToDelete(null)}
                  disabled={deleting}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1.4,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)'
                  }}
                  onClick={executeDeleteRecipe}
                  disabled={deleting}
                >
                  <FiTrash2 size={16} />
                  {deleting ? 'Siliniyor...' : 'Evet, Kalıcı Olarak Sil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Recipe Modal - GastroSync Temasına Tam Uyumlu */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              maxHeight: '94vh',
              background: '#ffffff',
              border: '1px solid #dbe7df',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(10, 31, 17, 0.18)'
            }}
          >
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ea', background: '#f8fbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <FiPlus size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>{t.createRecipeTitle}</h3>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>{t.createRecipeDesc}</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowAddModal(false)} style={{ color: '#64748b' }}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleSubmitRecipe} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-field">
                <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.recipeNameLabel}</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  placeholder={t.recipeNamePlaceholder}
                  required
                />
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-field">
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.categoryLabel}</label>
                  <select
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                    value={newRecipe.category}
                    onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
                  >
                    {['Ana Yemek', 'Salata', 'Kahvaltı', 'Tatlı', 'İçecek', 'Başlangıç', 'Yan Ürün', 'Pizza & Fırın', 'Deniz Ürünleri'].map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {getCategoryLabel(catKey, currentLanguage)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.salePriceLabel}</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '10px 14px', borderRadius: '8px' }}
                    value={newRecipe.salePrice}
                    onChange={(e) => setNewRecipe({ ...newRecipe, salePrice: e.target.value })}
                    placeholder="350"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>{t.ingredientListGrammage}</label>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <FiPlus /> {t.addNewIngredientRow}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fbf9', padding: '12px', borderRadius: '10px', border: '1px solid #e8f0ea' }}>
                  {newRecipe.ingredients.map((ing, idx) => (
                    <div key={idx} className="form-row ingredient-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: 0 }}>
                      <select
                        className="form-input"
                        style={{ flex: 3, background: '#ffffff', border: '1px solid #cbd5e1' }}
                        value={ing.itemId}
                        onChange={(e) => {
                          const updated = [...newRecipe.ingredients]
                          updated[idx].itemId = e.target.value
                          setNewRecipe({ ...newRecipe, ingredients: updated })
                        }}
                      >
                        <option value="">Malzeme seçin...</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.unit} — {item.price} ₺)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="form-input"
                        style={{ flex: 1.2, background: '#ffffff', border: '1px solid #cbd5e1' }}
                        placeholder="Miktar"
                        value={ing.amount}
                        onChange={(e) => {
                          const updated = [...newRecipe.ingredients]
                          updated[idx].amount = e.target.value
                          setNewRecipe({ ...newRecipe, ingredients: updated })
                        }}
                        min="0"
                        step="0.001"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = newRecipe.ingredients.filter((_, i) => i !== idx)
                          setNewRecipe({ ...newRecipe, ingredients: updated })
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Malzemeyi Çıkar"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowAddModal(false)}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0a1f11 0%, #163e23 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(10, 31, 17, 0.25)'
                  }}
                >
                  {t.saveRecipeBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
