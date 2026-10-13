import React, { useState } from 'react'
import { useRecipeStore, useInventoryStore } from '../store'
import { FiPlus, FiEdit3, FiTrash2, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
import '../styles/pages.css'

export default function RecipesPage() {
  const { recipes, addRecipe, deleteRecipe } = useRecipeStore()
  const { items } = useInventoryStore()
  const [expandedId, setExpandedId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // New recipe form state
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: 'Ana Yemek',
    salePrice: '',
    ingredients: [{ itemId: '', amount: '' }],
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

  const handleSubmitRecipe = (e) => {
    e.preventDefault()
    const ingredients = newRecipe.ingredients
      .filter((ing) => ing.itemId && ing.amount)
      .map((ing) => {
        const item = items.find((i) => i.id === parseInt(ing.itemId))
        return {
          itemId: parseInt(ing.itemId),
          name: item?.name || '',
          amount: parseFloat(ing.amount),
          unit: item?.unit || '',
        }
      })

    const cost = ingredients.reduce((sum, ing) => {
      const item = items.find((i) => i.id === ing.itemId)
      return sum + (item ? item.price * ing.amount : 0)
    }, 0)

    const salePrice = parseFloat(newRecipe.salePrice)
    const foodCostPercent = salePrice > 0 ? (cost / salePrice) * 100 : 0

    addRecipe({
      name: newRecipe.name,
      category: newRecipe.category,
      portions: 1,
      salePrice,
      ingredients,
      cost: Math.round(cost * 100) / 100,
      foodCostPercent: Math.round(foodCostPercent * 10) / 10,
    })

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
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Reçete Merkezi</h2>
          <p className="page-subtitle">
            Reçeteleri yönetin — POS entegrasyonu için referans gramajları buradan güncellenir
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <FiPlus /> Yeni Reçete
        </button>
      </div>

      {/* Recipe Cards */}
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="recipe-card animate-fade-in">
            <div className="recipe-card-top" onClick={() => toggleExpand(recipe.id)}>
              <div className="recipe-card-info">
                <span className="recipe-card-category">{recipe.category}</span>
                <h3 className="recipe-card-name">{recipe.name}</h3>
              </div>
              <div className="recipe-card-right">
                <div className={`recipe-cost-badge recipe-cost-badge--${getFoodCostClass(recipe.foodCostPercent)}`}>
                  %{recipe.foodCostPercent.toFixed(1)}
                </div>
                {expandedId === recipe.id ? <FiChevronUp /> : <FiChevronDown />}
              </div>
            </div>

            <div className="recipe-card-stats">
              <div className="recipe-stat">
                <span className="recipe-stat-label">Maliyet</span>
                <span className="recipe-stat-value">{recipe.cost.toFixed(2)} ₺</span>
              </div>
              <div className="recipe-stat">
                <span className="recipe-stat-label">Satış Fiyatı</span>
                <span className="recipe-stat-value recipe-stat-value--bold">{recipe.salePrice.toFixed(2)} ₺</span>
              </div>
              <div className="recipe-stat">
                <span className="recipe-stat-label">Kâr</span>
                <span className="recipe-stat-value recipe-stat-value--success">
                  {(recipe.salePrice - recipe.cost).toFixed(2)} ₺
                </span>
              </div>
            </div>

            {/* Expanded: Ingredients */}
            {expandedId === recipe.id && (
              <div className="recipe-card-expanded animate-fade-in">
                <h4 className="recipe-expanded-title">Malzeme Detayları (1 Porsiyon)</h4>
                <table className="recipe-ingredients-table">
                  <thead>
                    <tr>
                      <th>Malzeme</th>
                      <th>Miktar</th>
                      <th>Birim Maliyet</th>
                      <th>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.ingredients.map((ing, idx) => {
                      const item = items.find((i) => i.id === ing.itemId)
                      const unitCost = item ? item.price : 0
                      return (
                        <tr key={idx}>
                          <td className="td-bold">{ing.name}</td>
                          <td>{ing.amount} {ing.unit}</td>
                          <td>{unitCost.toFixed(2)} ₺/{ing.unit}</td>
                          <td className="td-bold">{(unitCost * ing.amount).toFixed(2)} ₺</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="recipe-card-actions">
                  <button className="btn-icon btn-icon--danger" onClick={() => deleteRecipe(recipe.id)} title="Sil">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Recipe Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Yeni Reçete Oluştur</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleSubmitRecipe}>
              <div className="form-field">
                <label>Reçete Adı</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  placeholder="Örn: Izgara Levrek"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Kategori</label>
                  <select
                    className="form-input"
                    value={newRecipe.category}
                    onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
                  >
                    <option>Ana Yemek</option>
                    <option>Salata</option>
                    <option>Kahvaltı</option>
                    <option>Tatlı</option>
                    <option>İçecek</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newRecipe.salePrice}
                    onChange={(e) => setNewRecipe({ ...newRecipe, salePrice: e.target.value })}
                    placeholder="Örn: 350"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Malzemeler</label>
                {newRecipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="form-row ingredient-row">
                    <select
                      className="form-input"
                      value={ing.itemId}
                      onChange={(e) => {
                        const updated = [...newRecipe.ingredients]
                        updated[idx].itemId = e.target.value
                        setNewRecipe({ ...newRecipe, ingredients: updated })
                      }}
                    >
                      <option value="">Malzeme seçin</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
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
                  </div>
                ))}
                <button type="button" className="btn-ghost" onClick={handleAddIngredient}>
                  <FiPlus /> Malzeme Ekle
                </button>
              </div>

              <button type="submit" className="btn-primary btn-full">
                Reçeteyi Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
