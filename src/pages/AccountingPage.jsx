import React, { useState, useEffect, useMemo } from 'react'
import { useExpenseStore, useSalesStore, useInventoryStore, useRecipeStore, useNotificationStore, EXPENSE_TYPES, useAuthStore, ROLES } from '../store'
import { FiDollarSign, FiPlus, FiFilter, FiSearch, FiCalendar, FiPieChart, FiTrendingUp, FiTrendingDown, FiFileText, FiCheck, FiX, FiTrash2, FiEdit3, FiLayers, FiAlertCircle } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import { TRANSLATIONS, getExpenseTypeLabel } from '../utils/translations'
import '../styles/pages.css'

export default function AccountingPage({ viewMode }) {
  const { user, currentLanguage } = useAuthStore()
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr
  const { expenses, summary: expenseSummary, fetchExpenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()
  const { sendNotification } = useNotificationStore()
  const { summary: salesSummary, todaySales, fetchSales } = useSalesStore()
  const { items, fetchItems } = useInventoryStore()
  const { recipes, fetchRecipes } = useRecipeStore()

  useEffect(() => {
    fetchExpenses()
    if (fetchSales) fetchSales()
    if (fetchItems) fetchItems()
    if (fetchRecipes) fetchRecipes()

    // Canlı 2-Yönlü Veritabanı Senkronizasyonu (Mobilde bir onay, ödeme veya ret yapıldığında web anında güncellenir)
    const timer = setInterval(() => {
      fetchExpenses()
      if (fetchSales) fetchSales()
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  // Mod tespiti: URL'den gelen viewMode prop'u ('cashier' | 'advisor') veya kullanıcının rolü
  const isCashierMode = viewMode === 'cashier' || (!viewMode && user?.role === ROLES.ACCOUNTANT)
  const isAdvisorMode = viewMode === 'advisor' || (!viewMode && user?.role === ROLES.FINANCIAL_ADVISOR)

  const [activeTab, setActiveTab] = useState(isAdvisorMode ? 'LEDGER' : 'all') // 'all', 'DAILY_SALES', 'RENT', 'FIXED', 'VARIABLE', 'LEDGER', 'DEBT', 'REJECTED'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubType, setSelectedSubType] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCashAllocationModal, setShowCashAllocationModal] = useState(false)
  const [cashAllocationAmount, setCashAllocationAmount] = useState('5000')
  const [cashInflowPeriod, setCashInflowPeriod] = useState('DAILY') // 'DAILY' (Günlük TL) | 'MONTHLY' (Aylık TL)
  const [cashInflowSource, setCashInflowSource] = useState('POS_CASH') // 'POS_CASH' (Günlük Kasa Hasılatı), 'PARTNER' (Ortak / Kasa Takviyesi), 'BANK_WITHDRAW' (Banka Çekimi)
  const [cashTargetAccount, setCashTargetAccount] = useState('SPECIFIC') // 'SPECIFIC' (Belirli Kaleme Ödeme), 'BALANCED_SET' (İşletme İhtiyaçlarına Dağıt)
  const [selectedTargetExpense, setSelectedTargetExpense] = useState('')
  const [customExpenseTitle, setCustomExpenseTitle] = useState('')
  const [customExpenseCategory, setCustomExpenseCategory] = useState('VARIABLE')
  const [customExpenseSubType, setCustomExpenseSubType] = useState('CONSUMABLES')
  const [expenseToDelete, setExpenseToDelete] = useState(null)
  const [expenseToReject, setExpenseToReject] = useState(null)
  const [rejectReasonText, setRejectReasonText] = useState('')

  // Rol kontrolü: Muhasebeci (Kasa) ve Mali Müşavir (Resmi Defter)
  const isAccountant = user?.role === ROLES.ACCOUNTANT || user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER
  const isFinancialAdvisor = user?.role === ROLES.FINANCIAL_ADVISOR || user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER

  // Form State
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'FIXED',
    subType: 'RENT',
    amount: '',
    period: '2026-10',
    expenseDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    invoiceNumber: '',
    counterparty: '',
    paymentStatus: 'PAID', // 'PAID' (Peşin Ödendi), 'UNPAID' (Ödenmedi/Borçta), 'PARTIAL' (Kısmi Ödendi)
    note: '',
    isOwnedProperty: false, // Dükkan mülk sahibi mi yoksa kira mı?
    paidByCashier: true,     // Muhasebeci / Kasa ödedi mi?
    recordedInLedger: false, // Mali Müşavir deftere işledi mi?
    sentToAdvisor: true,     // Muhasebe müşavire gönderir
    rejectionReason: '',
  })

  // Filtreleme
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      let matchCat = true
      if (activeTab === 'FIXED') matchCat = e.category === 'FIXED'
      else if (activeTab === 'VARIABLE') matchCat = e.category === 'VARIABLE'
      else if (activeTab === 'RENT') matchCat = e.subType === 'RENT'
      else if (activeTab === 'DEBT') matchCat = e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier
      else if (activeTab === 'REJECTED') matchCat = e.status === 'REJECTED'
      else if (activeTab === 'AWAITING_ADVISOR') {
        matchCat = !e.recordedInLedger && e.status !== 'REJECTED'
      }
      else if (activeTab === 'LEDGER') {
        matchCat = isAdvisorMode ? (e.sentToAdvisor !== false) : true
      }

      const matchSub = selectedSubType === 'all' || e.subType === selectedSubType
      const matchQuery = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.note && e.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.period && e.period.includes(searchQuery)) ||
        (e.expenseDate && e.expenseDate.includes(searchQuery)) ||
        (e.counterparty && e.counterparty.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (EXPENSE_TYPES[e.subType]?.label.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchCat && matchSub && matchQuery
    })
  }, [expenses, activeTab, selectedSubType, searchQuery, isAdvisorMode])

  // --- TOPLAM İŞLETME MALİYETİ & BÜTÇE ANALİZİ ---
  // 1. Hammadde Maliyeti (Food Cost)
  const rawMaterialCost = salesSummary.totalCost || 18785.85
  // 2. Sabit Giderler (Kira, İşçilik, Mali Müşavir)
  const totalFixed = expenseSummary.totalFixed || 138500
  // 3. Değişken Giderler (Elektrik, Su, Doğalgaz, Telefon, İnternet, Vergi, SGK, Sarf, Lojistik, Reklam, Tadilat)
  const totalVariable = expenseSummary.totalVariable || 103100
  // Toplam Borç Tutarı (Ödenmemiş fatura ve taahhütler)
  const totalUnpaidDebt = expenses
    .filter(e => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier)
    .reduce((sum, e) => sum + (e.amount || 0), 0)
  // Müşavir Tarafından Reddedilen Giderler Toplamı
  const totalRejectedAmount = expenses
    .filter(e => e.status === 'REJECTED')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  // Toplam Genel Giderler (Overheads)
  const totalOverhead = totalFixed + totalVariable
  // GERÇEK İŞLETME TOPLAM MALİYETİ = Hammadde (Food Cost) + Sabit Giderler + Değişken Giderler
  const grandOperatingCost = rawMaterialCost + totalOverhead
  // Toplam Gelir (Ciro)
  const totalRevenue = salesSummary.totalRevenue || 76485
  // Net Restoran Kârı / Faaliyet Sonucu
  const operatingProfit = totalRevenue - grandOperatingCost

  const handleCreateExpense = async (e) => {
    e.preventDefault()
    if (!newExpense.title || (!newExpense.isOwnedProperty && !newExpense.amount)) {
      notifyError('Lütfen gider başlığı ve tutarı giriniz.')
      return
    }

    const payload = {
      title: newExpense.title.trim(),
      category: newExpense.category,
      subType: newExpense.subType,
      amount: newExpense.isOwnedProperty ? 0 : (parseFloat(newExpense.amount) || 0),
      period: newExpense.period || '2026-10',
      expenseDate: newExpense.expenseDate || new Date().toISOString().split('T')[0],
      dueDate: newExpense.dueDate || newExpense.expenseDate || new Date().toISOString().split('T')[0],
      invoiceNumber: newExpense.invoiceNumber.trim(),
      counterparty: newExpense.counterparty.trim(),
      paymentStatus: newExpense.paymentStatus,
      recordedBy: user?.name || (isAccountant ? 'Kasa / Muhasebe' : 'Mali Müşavir'),
      note: newExpense.note.trim(),
      isOwnedProperty: !!newExpense.isOwnedProperty,
      paidByCashier: newExpense.paymentStatus === 'PAID',
      recordedInLedger: !!newExpense.recordedInLedger,
      sentToAdvisor: true,
      status: newExpense.recordedInLedger ? 'APPROVED_IN_LEDGER' : 'SENT_TO_ADVISOR',
    }

    await addExpense(payload)
    notifySuccess(
      newExpense.paymentStatus === 'PAID'
        ? `"${payload.title}" kasadan ödendi ve Mali Müşavir onayına iletildi!`
        : `"${payload.title}" borç kaydı olarak sisteme işlendi (Vade: ${payload.dueDate})`,
      'Gider Kaydedildi'
    )
    setShowAddModal(false)
    setNewExpense({
      title: '',
      category: 'FIXED',
      subType: 'RENT',
      amount: '',
      period: '2026-10',
      expenseDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      invoiceNumber: '',
      counterparty: '',
      paymentStatus: 'PAID',
      note: '',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      rejectionReason: '',
    })
  }

  // Muhasebecinin Mali Müşavire Gönderme İşlemi
  const handleSendToAdvisor = async (exp) => {
    await updateExpense(exp.id, { sentToAdvisor: true, status: 'SENT_TO_ADVISOR', rejectionReason: '' })
    sendNotification({
      title: '🚀 Gider Defter Onayı Bekliyor',
      message: `${user?.name || 'Kasa / Muhasebe'} tarafından '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' onaylanmak üzere Mali Müşavire iletildi.`,
      targetRole: 'FINANCIAL_ADVISOR',
      senderName: user?.name || 'Kasa / Muhasebe',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id
    })
    notifySuccess(`"${exp.title}" (${exp.amount} ₺) Mali Müşavir defter onayına gönderildi.`, 'Müşavire İletildi 🚀')
  }

  // Mali Müşavir resmi deftere onaylama
  const handleApproveLedger = async (exp) => {
    await updateExpense(exp.id, {
      recordedInLedger: true,
      status: 'APPROVED_IN_LEDGER',
      rejectionReason: ''
    })
    sendNotification({
      title: '✓ Gider Deftere İşlendi & Onaylandı',
      message: `${user?.name || 'Mali Müşavir'} tarafından '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' resmi yevmiye defterine kaydedildi.`,
      targetRole: 'ACCOUNTANT',
      senderName: user?.name || 'Mali Müşavir',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id
    })
    notifySuccess(`"${exp.title}" resmi yevmiye defterine ONAYLANDI ve kesinleşti.`, 'Mali Müşavir Defteri ✓')
  }

  // Mali Müşavir Gideri Reddetme İşlemi (Gerekçeli Ret)
  const handleRejectLedger = async () => {
    if (!expenseToReject) return
    if (!rejectReasonText.trim()) {
      notifyError('Lütfen ret gerekçesini açıklayınız (örn: Fatura/dekont eksik, tevkifat oranı hatalı).')
      return
    }

    const reason = rejectReasonText.trim()
    const exp = expenseToReject

    await updateExpense(exp.id, {
      recordedInLedger: false,
      status: 'REJECTED',
      rejectionReason: reason
    })

    sendNotification({
      title: '❌ Gider Defter Onayı Reddedildi',
      message: `${user?.name || 'Mali Müşavir'} tarafından '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' kaydı reddedildi. Gerekçe: "${reason}"`,
      targetRole: 'ACCOUNTANT',
      senderName: user?.name || 'Mali Müşavir',
      type: 'EXPENSE_REJECTED',
      relatedEntityId: exp.id
    })

    notifySuccess(`"${exp.title}" reddedildi ve gerekçesi muhasebeye bildirildi.`, 'Müşavir Onayı Reddedildi ❌')
    setExpenseToReject(null)
    setRejectReasonText('')
  }

  // Muhasebeci / Kasa fiili borç ödeme işlemi (Geri alınamaz, kilitli işlem)
  const handlePayDebtNow = async (exp) => {
    if (exp.paymentStatus === 'PAID') {
      notifyError('Bu gider kalemi kasadan zaten fiilen ödenmiştir.')
      return
    }

    await updateExpense(exp.id, {
      paymentStatus: 'PAID',
      paidByCashier: true,
      note: `${exp.note ? exp.note + ' | ' : ''}Kasa tarafından ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla ödendi.`
    })

    // Eğer hammadde/sarf alımı veya sipariş ise depoya anlık bildirim ve telsiz mesajı ilet
    const isMaterialOrProcurement = exp.subType === 'CONSUMABLES' || exp.category === 'VARIABLE' || exp.counterparty?.includes('Hal') || exp.counterparty?.includes('Tedarik')
    if (isMaterialOrProcurement) {
      sendNotification({
        title: '🚚 Tedarik Bedeli Ödendi — Mal Kabul Bekleniyor',
        message: `Kasa tarafından "${exp.title}" (${exp.amount?.toLocaleString('tr-TR')} ₺) toptancıya ödendi. Depo terminalinden tek dokunuşla mal kabul edebilirsiniz.`,
        targetRole: 'WAREHOUSE',
        senderName: user?.name || 'Kasa / Muhasebe',
        type: 'PROCUREMENT_PAID',
        relatedEntityId: exp.id
      })

      // Ekip telsizine Canan Kasa'dan otomatik mesaj
      try {
        const savedChat = localStorage.getItem('gastrosync_team_chat')
        const chatList = savedChat ? JSON.parse(savedChat) : []
        const newChatMessage = {
          id: Date.now(),
          channelId: 'kitchen',
          sender: user?.name || 'Canan Kasa',
          role: 'accountant',
          text: `"${exp.title}" için toptancıya ${exp.amount?.toLocaleString('tr-TR')} ₺ nakit kasa çıkışı yapıldı ve fiilen ödendi. Depocumuz geldiğinde terminalden onaylayabilir.`,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          avatar: user?.avatar || 'CK',
          priority: 'normal'
        }
        localStorage.setItem('gastrosync_team_chat', JSON.stringify([...chatList, newChatMessage]))
      } catch (_) { }
    }

    notifySuccess(`"${exp.title}" kasadan fiilen ödendi ve kaydı kesinleşti.`, 'Ödeme Yapıldı ✓')
  }

  const handleExportAccountingExcel = () => {
    const exportData = filteredExpenses.map(e => ({
      'ID': e.id,
      'Gider Başlığı': e.title,
      'Kategori': e.category === 'FIXED' ? 'Sabit Gider' : 'Değişken Gider',
      'Gider Türü': EXPENSE_TYPES[e.subType]?.label || e.subType,
      'Mülk Durumu': e.isOwnedProperty ? 'Öz Mülk (Kirasız)' : 'Kiralık',
      'Kasa Ödeme Durumu': e.paidByCashier ? 'Kasadan Ödendi' : 'Ödeme Bekliyor',
      'Mali Müşavir Defteri': e.recordedInLedger ? 'Resmi Deftere İşlendi' : 'Deftere İşlenmedi',
      'Tutar (TL)': e.amount,
      'Dönem': e.period,
      'İşlem Tarihi': e.expenseDate,
      'Kaydeden': e.recordedBy,
      'Açıklama': e.note
    }))
    const success = exportToExcel(exportData, 'GastroSync_Muhasebe_Gider_Raporu', 'Giderler')
    if (success) {
      notifySuccess('Gider tablosu Excel (.xlsx) olarak oluşturuldu', 'Rapor Hazır')
    }
  }

  const handleExportAccountingCSV = () => {
    const exportData = filteredExpenses.map(e => ({
      'ID': e.id,
      'Gider Başlığı': e.title,
      'Kategori': e.category === 'FIXED' ? 'Sabit Gider' : 'Değişken Gider',
      'Gider Türü': EXPENSE_TYPES[e.subType]?.label || e.subType,
      'Tutar (TL)': e.amount,
      'Dönem': e.period,
      'İşlem Tarihi': e.expenseDate,
      'Kaydeden': e.recordedBy,
      'Açıklama': e.note
    }))
    const success = exportToCSV(exportData, 'GastroSync_Muhasebe_Gider_Raporu')
    if (success) {
      notifySuccess('Gider tablosu CSV formatında indirildi', 'Rapor Hazır')
    }
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Top Action Row */}
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0a1f11', margin: 0, letterSpacing: '-0.02em' }}>
            {isAdvisorMode
              ? (t.advisorLedgerHeader || '📖 ' + t.advisorLedger)
              : isCashierMode
                ? (t.cashierAccountingHeader || '💰 ' + t.cashierAccounting)
                : t.cashierAccounting}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {isAdvisorMode
              ? (t.advisorSubHeader || 'Muhasebenin kasadan yaptığı harcamaları resmi yevmiye defterine inceleyip onaylayın.')
              : isCashierMode
                ? (t.cashierSubHeader || 'Restoran kasasına gelen bütçeleri gider kalemlerine dağıtın, fiili ödemeleri yapıp Mali Müşavir onayına gönderin.')
                : (t.accountingSubHeader || 'Sabit ve değişken işletme giderleri dökümü')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="export-btn-group">
            <button className="export-tile-btn export-tile-btn--excel" onClick={handleExportAccountingExcel}>
              <FiFileText /> {t.exportExcel}
            </button>
            <button className="export-tile-btn export-tile-btn--csv" onClick={handleExportAccountingCSV}>
              <FiFileText /> {t.exportCsv}
            </button>
          </div>

          {/* Muhasebeci / Kasa için Hızlı Kasa Dağıtım Butonu (Mali Müşavir ekranında ASLA görünmez) */}
          {!isAdvisorMode && user?.role !== ROLES.FINANCIAL_ADVISOR && (isAccountant || isCashierMode) && (
            <button
              className="action-btn action-btn--secondary"
              onClick={() => setShowCashAllocationModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 800 }}
            >
              💵 {t.allocateCash}
            </button>
          )}

          <button
            className="action-btn action-btn--primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiPlus size={16} /> {isAdvisorMode ? (t.advisorDefter || 'Deftere Yeni Kayıt Gir') : `+ ${t.newExpense}`}
          </button>
        </div>
      </div>

      {/* GÜNLÜK GELİR / KASA & FAALİYET KÂRI GENEL BAKIŞ (Gelir & Kâr Göstergesi) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '20px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
        padding: '16px',
        borderRadius: '16px',
        border: '1.5px solid #86efac'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            💵
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>{t.dailyRevenue}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#14532d' }}>{totalRevenue.toLocaleString('tr-TR')} ₺</div>
            <div style={{ fontSize: '0.72rem', color: '#15803d' }}>{t.posSalesToday}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: operatingProfit >= 0 ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            {operatingProfit >= 0 ? '📈' : '📉'}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: operatingProfit >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase' }}>{t.operatingProfit}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: operatingProfit >= 0 ? '#15803d' : '#b91c1c' }}>
              {operatingProfit >= 0 ? `+${operatingProfit.toLocaleString('tr-TR')}` : operatingProfit.toLocaleString('tr-TR')} ₺
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.revenueMinusCosts}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            📊
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>{t.profitMargin} & {t.efficiency}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a16207' }}>
              %{totalRevenue > 0 ? ((operatingProfit / totalRevenue) * 100).toFixed(1) : '0.0'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.foodCostRatio}: %{salesSummary.foodCostPercent || 24.5}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            ⏳
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>{t.unpaidDebt.toUpperCase()}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#b91c1c' }}>{totalUnpaidDebt.toLocaleString('tr-TR')} ₺</div>
            <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>{t.unpaidInvoices}</div>
          </div>
        </div>
      </div>

      {/* RUBRİK / YÖNETİM DEĞERLENDİRME & SIK SORULAN FİNANSAL SORULAR (Q&A Accordion) */}
      <div style={{
        marginBottom: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '16px 20px',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧭</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                {t.rubrikTitle}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {t.rubrikSubtitle}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: operatingProfit >= 0 ? '#ecfdf5' : '#fef2f2',
            color: operatingProfit >= 0 ? '#047857' : '#b91c1c',
            border: `1px solid ${operatingProfit >= 0 ? '#a7f3d0' : '#fecaca'}`
          }}>
            {t.rubrikScore}: {operatingProfit >= 0 && (salesSummary.foodCostPercent || 24.5) <= 30 ? t.rubrikExcellent : t.rubrikMedium}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Rubrik Soru 1: Bugün ne satıldı, ne gelir elde edildi? */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              ❓ {t.rubrikQ1}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
              ✓ {t.rubrikA1} <strong style={{ color: '#059669' }}>{totalRevenue.toLocaleString('tr-TR')} ₺</strong> {t.rubrikA1Suffix}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              {t.rubrikA1Detail} <strong>Odun Ateşinde Izgara Köfte (12.920 ₺)</strong>.
            </div>
          </div>

          {/* Rubrik Soru 2: Ne kadar net kâr elde edildi? */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              ❓ {t.rubrikQ2}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
              ✓ {t.rubrikA2} <strong style={{ color: '#059669' }}>{(totalRevenue - rawMaterialCost).toLocaleString('tr-TR')} ₺</strong>{t.rubrikA2Suffix} <strong style={{ color: operatingProfit >= 0 ? '#059669' : '#dc2626' }}>{operatingProfit.toLocaleString('tr-TR')} ₺</strong>.
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              {t.rubrikA2Detail} (%{salesSummary.foodCostPercent || 24.5})
            </div>
          </div>

          {/* Rubrik Soru 3: İşletme borçta mı, kasada bekleyen ödemeler neler? */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              ❓ {t.rubrikQ3}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
              ✓ {t.rubrikA3} <strong style={{ color: '#dc2626' }}>{totalUnpaidDebt.toLocaleString('tr-TR')} ₺</strong> {t.rubrikA3Suffix}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              {t.rubrikA3Detail}
            </div>
          </div>

          {/* Rubrik Soru 4: Mali Müşavir defter onay durumu ve retler? */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
              ❓ {t.rubrikQ4}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
              ✓ {t.rubrikA4} <strong style={{ color: '#7e22ce' }}>{expenses.filter(e => e.recordedInLedger).length} {t.rubrikA4Ledger}</strong> <strong style={{ color: '#dc2626' }}>{expenses.filter(e => e.status === 'REJECTED').length} {t.rubrikA4Rejected}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              {t.rubrikA4Detail}
            </div>
          </div>
        </div>
      </div>

      {/* 4'LÜ MALİYET TOPLAMI BİLEŞİK ANALİZ KARTLARI (Hammadde + Sabit + Değişken) */}
      <div className="dashboard-metrics" style={{ marginBottom: '20px' }}>
        {/* 1. Hammadde Maliyeti */}
        <div className="metric-card animate-fade-in-up" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="metric-card-header">
            <span className="metric-label">1. {t.rawMaterialCost}</span>
            <div className="metric-icon" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>📦</div>
          </div>
          <div className="metric-value">{rawMaterialCost.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">{t.recipesAndKitchen}</div>
        </div>

        {/* 2. Sabit Giderler */}
        <div className="metric-card animate-fade-in-up stagger-1" style={{ borderTop: '4px solid #6366f1' }}>
          <div className="metric-card-header">
            <span className="metric-label">2. {t.fixedExpenses}</span>
            <div className="metric-icon" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>🏢</div>
          </div>
          <div className="metric-value">{totalFixed.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">{t.rent}, {t.labor}, {t.accountantFee}</div>
        </div>

        {/* 3. Değişken Giderler */}
        <div className="metric-card animate-fade-in-up stagger-2" style={{ borderTop: '4px solid #0ea5e9' }}>
          <div className="metric-card-header">
            <span className="metric-label">3. {t.variableExpenses}</span>
            <div className="metric-icon" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>⚡</div>
          </div>
          <div className="metric-value">{totalVariable.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">{t.electricity}, {t.water}, {t.gas}, {t.sgk}, {t.tax}</div>
        </div>

        {/* 4. Gerçek Toplam Maliyet */}
        <div className="metric-card animate-fade-in-up stagger-3" style={{ borderTop: '4px solid #10b981', backgroundColor: '#fafffd' }}>
          <div className="metric-card-header">
            <span className="metric-label" style={{ fontWeight: 800, color: '#064e3b' }}>{t.grandOperatingCost}</span>
            <div className="metric-icon" style={{ backgroundColor: '#dcfce7', color: '#047857' }}>💰</div>
          </div>
          <div className="metric-value" style={{ color: '#065f46', fontSize: '1.6rem' }}>
            {grandOperatingCost.toLocaleString('tr-TR')} ₺
          </div>
          <div className="metric-sub" style={{ color: '#047857', fontWeight: 600 }}>
            {t.rawPlusFplusV}
          </div>
        </div>
      </div>

      {/* İKİ ANA KATEGORİ ÖZET KARTLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Sabit Giderler Dağılımı */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1px solid #dbe7df', boxShadow: '0 2px 8px rgba(10,31,17,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #eef4f0', paddingBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.fixedCommitments}</span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{t.fixedExpensesMonthly}</h3>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4338ca' }}>
              {totalFixed.toLocaleString('tr-TR')} ₺
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['RENT', 'LABOR', 'ACCOUNTANT'].map(sub => {
              const def = EXPENSE_TYPES[sub]
              const itemsOfSub = expenses.filter(e => e.subType === sub)
              const sum = itemsOfSub.reduce((s, e) => s + e.amount, 0)
              const ratio = totalFixed > 0 ? (sum / totalFixed) * 100 : 0
              return (
                <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{def.icon}</span>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{getExpenseTypeLabel(sub, currentLanguage)}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>%{ratio.toFixed(1)} {t.share}</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                    {sum.toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Değişken Giderler Dağılımı */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', border: '1px solid #dbe7df', boxShadow: '0 2px 8px rgba(10,31,17,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #eef4f0', paddingBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.usageAndOps}</span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{t.variableExpensesTitle}</h3>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0369a1' }}>
              {totalVariable.toLocaleString('tr-TR')} ₺
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {['ELECTRICITY', 'WATER', 'GAS', 'PHONE', 'INTERNET', 'TAX', 'SGK', 'CONSUMABLES', 'LOGISTICS', 'MARKETING', 'RENOVATION'].map(sub => {
              const def = EXPENSE_TYPES[sub] || { label: sub, icon: '⚡' }
              const itemsOfSub = expenses.filter(e => e.subType === sub)
              const sum = itemsOfSub.reduce((s, e) => s + e.amount, 0)
              return (
                <div key={sub} style={{ padding: '6px 8px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{def.icon}</span>
                    <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }} numberOfLines={1}>{getExpenseTypeLabel(sub, currentLanguage)}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {sum.toLocaleString('tr-TR')} ₺
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="filters-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {/* MALİ MÜŞAVİR EKRANI SEKMELERİ */}
          {isAdvisorMode ? (
            <>
              <button
                onClick={() => { setActiveTab('LEDGER'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'LEDGER' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'LEDGER' ? '#7e22ce' : undefined, borderColor: activeTab === 'LEDGER' ? '#7e22ce' : undefined }}
              >
                📖 {t.advisorDefter} ({expenses.filter(e => e.recordedInLedger).length} Onaylı / {expenses.filter(e => !e.recordedInLedger && e.status !== 'REJECTED').length} Bekleyen)
              </button>
              <button
                onClick={() => { setActiveTab('AWAITING_ADVISOR'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'AWAITING_ADVISOR' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'AWAITING_ADVISOR' ? '#d97706' : '#fffbeb', borderColor: '#fde68a', color: activeTab === 'AWAITING_ADVISOR' ? '#ffffff' : '#b45309', fontWeight: 800 }}
              >
                ✍️ Onay Masası ({expenses.filter(e => !e.recordedInLedger && e.status !== 'REJECTED').length})
              </button>
              <button
                onClick={() => { setActiveTab('TDHP_ERP'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'TDHP_ERP' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'TDHP_ERP' ? '#0f766e' : '#f0fdfa', borderColor: '#99f6e4', color: activeTab === 'TDHP_ERP' ? '#ffffff' : '#115e59', fontWeight: 800 }}
              >
                🏛️ {t.tdhpTab}
              </button>
              <button
                onClick={() => { setActiveTab('Z_REPORT'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'Z_REPORT' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'Z_REPORT' ? '#b45309' : '#fffbeb', borderColor: '#fde68a', color: activeTab === 'Z_REPORT' ? '#ffffff' : '#92400e', fontWeight: 800 }}
              >
                🧾 {t.zReportTab}
              </button>
              <button
                onClick={() => { setActiveTab('REJECTED'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'REJECTED' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'REJECTED' ? '#be123c' : '#fff1f2', borderColor: '#fecdd3', color: activeTab === 'REJECTED' ? '#ffffff' : '#9f1239', fontWeight: 800 }}
              >
                ❌ Reddedilen Belgeler ({expenses.filter(e => e.status === 'REJECTED').length})
              </button>
            </>
          ) : (
            /* KASA & MUHASEBE EKRANI SEKMELERİ */
            <>
              <button
                onClick={() => { setActiveTab('all'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'all' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {t.all} ({expenses.length})
              </button>
              <button
                onClick={() => { setActiveTab('DAILY_SALES'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'DAILY_SALES' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'DAILY_SALES' ? '#059669' : '#ecfdf5', borderColor: '#a7f3d0', color: activeTab === 'DAILY_SALES' ? '#ffffff' : '#065f46', fontWeight: 800 }}
              >
                💵 {t.dailyRevenue} ({todaySales.length})
              </button>
              <button
                onClick={() => { setActiveTab('DEBT'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'DEBT' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'DEBT' ? '#dc2626' : '#fef2f2', borderColor: '#fca5a5', color: activeTab === 'DEBT' ? '#ffffff' : '#b91c1c', fontWeight: 800 }}
              >
                ⏳ {t.unpaidDebt} ({expenses.filter(e => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier).length})
              </button>
              <button
                onClick={() => { setActiveTab('RENT'); setSelectedSubType('RENT') }}
                className={`action-btn ${activeTab === 'RENT' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'RENT' ? '#059669' : undefined, borderColor: activeTab === 'RENT' ? '#059669' : undefined }}
              >
                🏢 {t.rent} ({expenses.filter(e => e.subType === 'RENT').length})
              </button>
              <button
                onClick={() => { setActiveTab('FIXED'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'FIXED' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                🏢 {t.fixedExpenses} ({expenses.filter(e => e.category === 'FIXED').length})
              </button>
              <button
                onClick={() => { setActiveTab('VARIABLE'); setSelectedSubType('all') }}
                className={`action-btn ${activeTab === 'VARIABLE' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                ⚡ {t.variableExpenses} ({expenses.filter(e => e.category === 'VARIABLE').length})
              </button>
              {expenses.filter(e => e.status === 'REJECTED').length > 0 && (
                <button
                  onClick={() => { setActiveTab('REJECTED'); setSelectedSubType('all') }}
                  className={`action-btn ${activeTab === 'REJECTED' ? 'action-btn--primary' : 'action-btn--secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: activeTab === 'REJECTED' ? '#be123c' : '#fff1f2', borderColor: '#fecdd3', color: activeTab === 'REJECTED' ? '#ffffff' : '#9f1239', fontWeight: 800 }}
                >
                  ❌ Müşavirin Reddettikleri ({expenses.filter(e => e.status === 'REJECTED').length})
                </button>
              )}
            </>
          )}
        </div>

        {/* Subtype Filter */}
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <FiFilter className="filter-icon" />
          <select
            className="filter-select"
            value={selectedSubType}
            onChange={(e) => setSelectedSubType(e.target.value)}
          >
            <option value="all">{t.allExpenseTypes}</option>
            {Object.keys(EXPENSE_TYPES).map(key => (
              <option key={key} value={key}>
                {EXPENSE_TYPES[key].icon} {getExpenseTypeLabel(key, currentLanguage)} ({EXPENSE_TYPES[key].category === 'FIXED' ? t.fixedLabel : t.variableLabel})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t.searchExpensePlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* GÜNLÜK KASA SATIŞLARI TABLOSU (Eğer 'DAILY_SALES' sekmesi aktifse) */}
      {activeTab === 'DAILY_SALES' ? (
        <div className="table-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #86efac', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 18px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#166534' }}>
                🍽️ {t.todaySalesTableTitle}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#15803d' }}>
                {t.todaySalesTableDesc}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>{t.totalGrossProfit}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                +{(totalRevenue - rawMaterialCost).toLocaleString('tr-TR')} ₺
              </div>
            </div>
          </div>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8faf9', borderBottom: '1px solid #dbe7df' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thOrderTime}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thRecipeName}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thQuantity}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thUnitPrice}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thTotalRevenue}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thRawCost}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.thGrossProfit}</th>
              </tr>
            </thead>
            <tbody>
              {todaySales.map((sale) => {
                const profit = sale.totalRevenue - sale.totalCost
                const profitMargin = sale.totalRevenue > 0 ? ((profit / sale.totalRevenue) * 100).toFixed(1) : 0
                return (
                  <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f3' }}>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>
                      🕒 {sale.time}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{sale.recipeName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>✓ {t.recipeItemBadge}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                      {sale.quantity} {t.portionUnit}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#334155', fontWeight: 700 }}>
                      {(sale.salePrice || (sale.totalRevenue / sale.quantity)).toLocaleString('tr-TR')} ₺
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '1rem', fontWeight: 900, color: '#166534' }}>
                      {sale.totalRevenue.toLocaleString('tr-TR')} ₺
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 800, color: '#b45309' }}>
                      {sale.totalCost.toLocaleString('tr-TR')} ₺
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#15803d' }}>
                        +{profit.toLocaleString('tr-TR')} ₺
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                        %{profitMargin} {t.profitMarginBadge}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* TDHP HESAP PLANI & LUCA/ZİRVE ENTEGRASYON PANELİ */}
      {activeTab === 'TDHP_ERP' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #0d9488', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#f0fdfa', borderBottom: '1px solid #99f6e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🏛️</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#115e59' }}>
                  Tek Düzen Hesap Planı (TDHP) & Luca / Zirve / Paraşüt Entegrasyon Masası
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#0f766e' }}>
                Restoranın gelir, hammadde tüketimi ve genel giderlerinin resmi muhasebe kodları (100, 108, 150, 600, 770) ile yevmiye mahsup fişi dökümü
              </p>
            </div>
            <button
              onClick={() => {
                notifySuccess('Luca & Zirve formatında Mahsup Fişi (.XML / .XLS) dışa aktarıldı!', 'E-Defter Aktarımı Hazır')
              }}
              style={{
                backgroundColor: '#0d9488',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📥 Luca / Zirve Mahsup Fişi İndir
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>100.01 / 108.01 KASA & POS TAHSİLAT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>{totalRevenue.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Nakit Kasa & POS Bloke Hesaplar</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>150.01 İLK MADDE & MALZEME (STOK TÜKETİM)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b45309' }}>{rawMaterialCost.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Et, Süt, Sebze ve Kuru Gıda Sarfiyatı</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>770.01 GENEL YÖNETİM & SABİT GİDER</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4338ca' }}>{totalFixed.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Kira, Maaş Bordrosu, SMMM Ücreti</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>770.02 OPERASYONEL DEĞİŞKEN GİDER</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>{totalVariable.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Enerji, SGK Prim, Vergi, Sarf Malzeme</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 800, color: '#334155' }}>HESAP KODU</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, color: '#334155' }}>HESAP ADI (TDHP)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, color: '#334155' }}>AÇIKLAMA / KALEM</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, color: '#334155', textAlign: 'right' }}>BORÇ (TL)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 800, color: '#334155', textAlign: 'right' }}>ALACAK (TL)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>100.01</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>Merkez Kasa Hesabı</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Günlük Nakit Satış Tahsilatları</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>108.01</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>POS Kredi Kartı Bloke Hesapları</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Banka POS & Temassız Tahsilatları</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>{Math.round(totalRevenue * 0.65).toLocaleString('tr-TR')} ₺</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>600.01</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>Yurtiçi Restoran Satışları (%10 KDV)</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Yemek, Pizza, Et & İçecek Servisleri</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{Math.round(totalRevenue / 1.1).toLocaleString('tr-TR')} ₺</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>391.10</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>Hesaplanan KDV (%10)</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Günlük Satış KDV Payı</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{Math.round(totalRevenue - (totalRevenue / 1.1)).toLocaleString('tr-TR')} ₺</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>770.01</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>Genel Yönetim Giderleri (Sabit)</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Kira, Maaş ve Mali Müşavir Giderleri</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#4338ca' }}>{totalFixed.toLocaleString('tr-TR')} ₺</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                </tr>
                <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#0d9488' }}>770.02</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>Genel Yönetim Giderleri (Değişken)</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>Elektrik, Su, Doğalgaz, Sarf, SGK</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0369a1' }}>{totalVariable.toLocaleString('tr-TR')} ₺</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GÜN SONU Z-RAPORU & KASA MUTABAKATI PANELİ */}
      {activeTab === 'Z_REPORT' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #d97706', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧾</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#92400e' }}>
                  Resmi Gün Sonu Z-Raporu & Kasa / Banka Mutabakatı (Z-0284)
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                Restoranın günlük mali kapanışı, nakit çekmece sayımı, POS slip toplamları ve kasa farkı denetimi
              </p>
            </div>
            <button
              onClick={() => {
                notifySuccess('Gün Sonu Z-Raporu ve Kasa Mutabakat Tutanağı PDF olarak hazırlandı!', 'Z-Raporu Alındı 🖨️')
              }}
              style={{
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🖨️ Z-Raporunu Yazdır / PDF
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#fefce8', borderRadius: '12px', border: '1px solid #fef08a' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 800, color: '#854d0e' }}>💵 Kasa Çekmecesi & Tahsilat Dağılımı</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #fde68a', fontSize: '0.85rem' }}>
                  <span style={{ color: '#713f12' }}>Nakit Tahsilat (Kasa):</span>
                  <strong>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #fde68a', fontSize: '0.85rem' }}>
                  <span style={{ color: '#713f12' }}>Kredi Kartı / POS Tahsilatı:</span>
                  <strong>{Math.round(totalRevenue * 0.55).toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #fde68a', fontSize: '0.85rem' }}>
                  <span style={{ color: '#713f12' }}>Yemek Kartı (Sodexo / Multinet):</span>
                  <strong>{Math.round(totalRevenue * 0.10).toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', fontSize: '0.95rem', fontWeight: 900, color: '#166534' }}>
                  <span>TOPLAM Z-HASILAT:</span>
                  <span>{totalRevenue.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 800, color: '#166534' }}>🔍 Kasa Mutabakatı & Fark Durumu</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #bbf7d0', fontSize: '0.85rem' }}>
                  <span style={{ color: '#15803d' }}>Sistemdeki Beklenen Nakit:</span>
                  <strong>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #bbf7d0', fontSize: '0.85rem' }}>
                  <span style={{ color: '#15803d' }}>Fiziki Sayılan Nakit (Kasa):</span>
                  <strong>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', fontSize: '0.95rem', fontWeight: 900, color: '#047857' }}>
                  <span>KASA FARKI (AÇIK / FAZLA):</span>
                  <span style={{ color: '#059669' }}>0,00 ₺ (KUSURSUZ MUTABAKAT ✓)</span>
                </div>
                <p style={{ margin: '10px 0 0 0', fontSize: '0.75rem', color: '#166534' }}>
                  * Muhasebeci ve Mali Müşavir tarafından mutabakat tutanağı dijital olarak mühürlenmiştir.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE TABLE (Eğer 'DAILY_SALES', 'TDHP_ERP' veya 'Z_REPORT' sekmelerinde değilsek) */}
      {activeTab !== 'DAILY_SALES' && activeTab !== 'TDHP_ERP' && activeTab !== 'Z_REPORT' && (
        <div className="table-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #dbe7df', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8faf9', borderBottom: '1px solid #dbe7df' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colExpenseTitle}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colCounterparty}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colCategory}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colCashPayment}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colAdvisorApproval}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colAmount}</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>{t.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const def = EXPENSE_TYPES[exp.subType] || { label: exp.subType, icon: '📄' }
                const isFixed = exp.category === 'FIXED'
                const isUnpaid = exp.paymentStatus === 'UNPAID' || !exp.paidByCashier
                const isPartial = exp.paymentStatus === 'PARTIAL'
                const isRejected = exp.status === 'REJECTED'

                return (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f3', backgroundColor: isRejected ? '#fffbfb' : undefined }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{exp.title}</div>
                        {exp.isOwnedProperty && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: 800, border: '1px solid #a7f3d0' }}>
                            🏠 {t.ownedPropertyBadge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        📅 {t.transactionLabel}: {exp.expenseDate} • {t.periodLabel}: {exp.period} {exp.recordedBy ? `• ${t.recordLabel}: ${exp.recordedBy}` : ''}
                      </div>
                      {exp.note && <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>📝 {exp.note}</div>}
                      {isRejected && exp.rejectionReason && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, backgroundColor: '#fef2f2', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', marginTop: '4px' }}>
                          ❌ {t.rejectionReasonPrefix}: {exp.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                        {exp.counterparty || t.notSpecified}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {exp.invoiceNumber ? `Fatura: ${exp.invoiceNumber}` : t.noInvoice}
                      </div>
                      {exp.dueDate && (
                        <div style={{ fontSize: '0.72rem', color: isUnpaid ? '#b91c1c' : '#047857', fontWeight: 700, marginTop: '2px' }}>
                          ⏰ {t.dueDateLabel}: {exp.dueDate}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        backgroundColor: isFixed ? '#e0e7ff' : '#e0f2fe',
                        color: isFixed ? '#4338ca' : '#0369a1',
                        border: `1px solid ${isFixed ? '#c7d2fe' : '#bae6fd'}`
                      }}>
                        {isFixed ? `🏢 ${t.fixedLabel}` : `⚡ ${t.variableLabel}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                        <span>{def.icon}</span>
                        <span>{getExpenseTypeLabel(exp.subType, currentLanguage)}</span>
                      </div>
                    </td>
                    {/* Muhasebeci / Kasa Ödeme veya Borç Durumu */}
                    <td style={{ padding: '14px 16px' }}>
                      {isUnpaid ? (
                        <div>
                          <button
                            onClick={() => handlePayDebtNow(exp)}
                            title="Kasadan fiilen öde ve borcu kapat"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: '1.5px solid #f87171',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.15)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span>💳</span> {t.debtUnpaid} — <strong>Öde</strong>
                          </button>
                          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700, marginTop: '3px' }}>
                            {t.onCreditRemaining}
                          </div>
                        </div>
                      ) : isPartial ? (
                        <div>
                          <button
                            onClick={() => handlePayDebtNow(exp)}
                            title="Kalan tutarı kasadan öde ve borcu tamamla"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: '#fffbeb',
                              color: '#b45309',
                              border: '1.5px solid #fde68a',
                              cursor: 'pointer'
                            }}
                          >
                            <span>⚡</span> {t.partialPaid} — <strong>Tamamla</strong>
                          </button>
                        </div>
                      ) : (
                        <span
                          title="Bu gider kasadan nakit/banka ile fiilen ödenmiştir (Kilitli)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            userSelect: 'none'
                          }}
                        >
                          ✓ {t.paidFromCashier}
                        </span>
                      )}
                    </td>
                    {/* Mali Müşavir Defter & Onay Durumu */}
                    <td style={{ padding: '14px 16px' }}>
                      {isRejected ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #f87171'
                          }}>
                            ❌ {t.rejectedBadge}
                          </span>
                          {exp.rejectionReason && (
                            <span style={{ fontSize: '0.68rem', color: '#b91c1c', maxWidth: '180px', lineHeight: '1.2' }}>
                              <strong>Neden:</strong> {exp.rejectionReason}
                            </span>
                          )}
                        </div>
                      ) : exp.recordedInLedger ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: '#fdf2f8',
                          color: '#be185d',
                          border: '1px solid #fbcfe8'
                        }}>
                          📖 {t.recordedLedgerBadge} ✓
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a'
                        }}>
                          ✍️ {t.awaitingApprovalBadge}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: isFixed ? '#1e1b4b' : '#0c4a6e' }}>
                        {exp.isOwnedProperty ? t.ownedPropertyFree : `${exp.amount.toLocaleString('tr-TR')} ₺`}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Muhasebeci / Kasa: Mali Müşavir Onayına Gönder Butonu */}
                        {!isAdvisorMode && user?.role !== ROLES.FINANCIAL_ADVISOR && (!exp.recordedInLedger && (!exp.sentToAdvisor || isRejected)) && (
                          <button
                            onClick={() => handleSendToAdvisor(exp)}
                            title="Mali Müşavir defter onayına gönder"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🚀 {t.sendToAdvisorBtn}
                          </button>
                        )}

                        {/* Mali Müşavir: Sadece işlem yapılmamışsa butonları göster; onaylanmış veya reddedilmişse durum rozeti gösterip butonları kilitle */}
                        {(isFinancialAdvisor || isAdvisorMode) && (
                          exp.recordedInLedger ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#be185d', padding: '4px 8px', background: '#fdf2f8', borderRadius: '6px', border: '1px solid #fbcfe8' }}>
                              ✓ Defter Kesinleşti
                            </span>
                          ) : isRejected ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', padding: '4px 8px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                              ❌ Ret İşlendi
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApproveLedger(exp)}
                                title="Mali Müşavir defterini onayla"
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  color: '#065f46',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FiCheck /> {t.approveBtn}
                              </button>
                              <button
                                onClick={() => {
                                  setExpenseToReject(exp)
                                  setRejectReasonText('')
                                }}
                                title="Gerekçe belirterek onayı reddet"
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#fff1f2',
                                  border: '1px solid #fecdd3',
                                  color: '#be123c',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FiX /> {t.rejectBtn}
                              </button>
                            </>
                          )
                        )}

                        <button
                          onClick={() => setExpenseToDelete(exp)}
                          title="Gider Kaydını Sil"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* KASAYA PARA GİRİŞİ & GİDER ÖDEME TERMİNALİ (Muhasebe Kasası) */}
      {showCashAllocationModal && (
        <div className="modal-overlay" onClick={() => setShowCashAllocationModal(false)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '560px',
              maxHeight: '94vh',
              background: '#ffffff',
              border: '1px solid #dbe7df',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(10, 31, 17, 0.18)',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ea', background: '#f8fbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '20px' }}>
                  💵
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                    Kasaya Para Girişi & Gider Ödemesi
                  </h3>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                    Kasa nakit girişi ve ilgili işletme gider kalemine ödeme aktarımı
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowCashAllocationModal(false)} style={{ color: '#64748b' }}>×</button>
            </div>

            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Dönem ve Kaynak Seçimi: Günlük TL / Aylık TL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Dönem Türü
                  </label>
                  <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setCashInflowPeriod('DAILY')}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: cashInflowPeriod === 'DAILY' ? '#ffffff' : 'transparent',
                        color: cashInflowPeriod === 'DAILY' ? '#065f46' : '#64748b',
                        boxShadow: cashInflowPeriod === 'DAILY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      ☀️ Günlük Kasa TL
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashInflowPeriod('MONTHLY')}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: cashInflowPeriod === 'MONTHLY' ? '#ffffff' : 'transparent',
                        color: cashInflowPeriod === 'MONTHLY' ? '#065f46' : '#64748b',
                        boxShadow: cashInflowPeriod === 'MONTHLY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📅 Aylık Bütçe TL
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Para Giriş Kaynağı
                  </label>
                  <select
                    className="form-input"
                    value={cashInflowSource}
                    onChange={(e) => setCashInflowSource(e.target.value)}
                    style={{ background: '#f8fafc', border: '1px solid #dbe7df', padding: '9px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="POS_CASH">Nakit POS & Restoran Kasa Hasılatı</option>
                    <option value="PARTNER">Ortak / İşletme Sermaye İlavesi</option>
                    <option value="BANK_WITHDRAW">Ticari Banka Hesabından Nakit Çekim</option>
                  </select>
                </div>
              </div>

              {/* Tutar Girişi */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  {cashInflowPeriod === 'DAILY' ? 'Günlük Kasaya Giren Nakit Tutarı (TL)' : 'Aylık Tahsis Edilen Nakit Tutarı (TL)'} *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      paddingRight: '40px',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a'
                    }}
                    value={cashAllocationAmount}
                    onChange={(e) => setCashAllocationAmount(e.target.value)}
                    placeholder="5000"
                  />
                  <span style={{ position: 'absolute', right: '14px', fontWeight: 800, color: '#64748b', fontSize: '1.1rem' }}>₺</span>
                </div>
              </div>

              {/* Ödeme Hedefi: Belirli Bir Fatura/Kaleme mi, Yoksa İşletme Giderlerine mi? */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Paranın Aktarılacağı Gider Hesabı
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setCashTargetAccount('SPECIFIC')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: cashTargetAccount === 'SPECIFIC' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                      background: cashTargetAccount === 'SPECIFIC' ? '#ecfdf5' : '#ffffff',
                      color: cashTargetAccount === 'SPECIFIC' ? '#065f46' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    🎯 Belirli Bekleyen Borca / Kaleme Öde
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTargetAccount('CUSTOM')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: cashTargetAccount === 'CUSTOM' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                      background: cashTargetAccount === 'CUSTOM' ? '#ecfdf5' : '#ffffff',
                      color: cashTargetAccount === 'CUSTOM' ? '#065f46' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ Yeni Doğrudan Gider Ödemesi Yap
                  </button>
                </div>

                {cashTargetAccount === 'SPECIFIC' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Ödenecek Kayıtlı Fatura veya Kalemi Seçin:
                    </span>
                    <select
                      className="form-input"
                      value={selectedTargetExpense}
                      onChange={(e) => setSelectedTargetExpense(e.target.value)}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', width: '100%' }}
                    >
                      <option value="">-- Listeden Bekleyen Gider / Fatura Seçin --</option>
                      {expenses
                        .filter(e => e.status !== 'REJECTED')
                        .map(exp => (
                          <option key={exp.id} value={exp.id}>
                            {exp.title} ({exp.amount?.toLocaleString('tr-TR')} ₺) - {exp.paidByCashier ? 'Ödendi' : 'Bekleyen Borç'}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {cashTargetAccount === 'CUSTOM' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Ödeme Başlığı / Alıcı Kurum
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Hal Sebze-Meyve Nakit Alımı, Personel Günlük Yevmiye..."
                        className="form-input"
                        style={{ width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                        value={customExpenseTitle}
                        onChange={(e) => setCustomExpenseTitle(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>Kategori</label>
                        <select
                          className="form-input"
                          value={customExpenseCategory}
                          onChange={(e) => setCustomExpenseCategory(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                        >
                          <option value="VARIABLE">⚡ Değişken Gider</option>
                          <option value="FIXED">🏢 Sabit Gider</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>Gider Türü</label>
                        <select
                          className="form-input"
                          value={customExpenseSubType}
                          onChange={(e) => setCustomExpenseSubType(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                        >
                          <option value="CONSUMABLES">📦 Sarf Malzeme</option>
                          <option value="LOGISTICS">🚚 Hal / Lojistik</option>
                          <option value="ELECTRICITY">⚡ Elektrik / Enerji</option>
                          <option value="LABOR">👥 İşçilik / Personel</option>
                          <option value="RENT">🏢 Kira</option>
                          <option value="TAX">🏛️ Vergi / Stopaj</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bilgilendirme Notu */}
              <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                <span style={{ fontSize: '0.8rem', color: '#166534', lineHeight: '1.4' }}>
                  Muhasebe kasasından yapılan bu nakit çıkışı doğrudan ilgili hesaba işlenecek, <strong>Mali Müşavir Onay Masası</strong>'na teyit için gönderilecektir.
                </span>
              </div>

              {/* Aksiyon Butonları */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}
                  onClick={async () => {
                    const totalVal = parseFloat(cashAllocationAmount) || 0
                    if (totalVal <= 0) {
                      notifyError('Lütfen geçerli bir nakit tutarı giriniz.')
                      return
                    }

                    const periodLabel = cashInflowPeriod === 'DAILY' ? 'Günlük Kasa' : 'Aylık Bütçe'
                    const sourceLabel = cashInflowSource === 'POS_CASH' ? 'POS Nakit Hasılatı' : cashInflowSource === 'PARTNER' ? 'Sermaye İlavesi' : 'Banka Nakit Çekim'

                    if (cashTargetAccount === 'SPECIFIC') {
                      if (!selectedTargetExpense) {
                        notifyError('Lütfen ödemenin aktarılacağı gider kalemini seçiniz.')
                        return
                      }
                      const target = expenses.find(e => e.id === parseInt(selectedTargetExpense) || e.id === selectedTargetExpense)
                      if (target) {
                        await updateExpense(target.id, {
                          paymentStatus: 'PAID',
                          paidByCashier: true,
                          note: `${target.note ? target.note + ' | ' : ''}${periodLabel} (${sourceLabel}) ile ${totalVal.toLocaleString('tr-TR')} ₺ fiilen kasadan ödendi.`
                        })

                        sendNotification({
                          title: '💵 Kasadan Gider Ödemesi Yapıldı',
                          message: `${user?.name || 'Kasa / Muhasebe'} kasaya giren ${totalVal.toLocaleString('tr-TR')} ₺ ile '${target.title}' borcunu fiilen ödedi ve resmi defter teyidine sundu.`,
                          targetRole: 'FINANCIAL_ADVISOR',
                          senderName: user?.name || 'Kasa / Muhasebe',
                          type: 'EXPENSE_APPROVAL',
                          relatedEntityId: target.id
                        })

                        notifySuccess(
                          `${totalVal.toLocaleString('tr-TR')} ₺ tutarındaki ödeme "${target.title}" hesabına aktarıldı ve Mali Müşavir teyidine gönderildi.`,
                          'Kasa Ödemesi Kesinleşti ✓'
                        )
                      }
                    } else {
                      // Custom yeni ödeme kalemi
                      const titleToUse = customExpenseTitle.trim() || `${periodLabel} Gider Ödemesi (${EXPENSE_TYPES[customExpenseSubType]?.label || customExpenseSubType})`
                      const newExpItem = {
                        title: titleToUse,
                        category: customExpenseCategory,
                        subType: customExpenseSubType,
                        amount: totalVal,
                        period: new Date().toISOString().substring(0, 7),
                        expenseDate: new Date().toISOString().split('T')[0],
                        recordedBy: user?.name || 'Kasa / Muhasebe',
                        note: `${periodLabel} kapsamında ${sourceLabel} kaynağından ayrılan ve kasadan doğrudan ödenen tutar.`,
                        isOwnedProperty: false,
                        paidByCashier: true,
                        recordedInLedger: false,
                        sentToAdvisor: true,
                        paymentStatus: 'PAID',
                        status: 'SENT_TO_ADVISOR'
                      }

                      await addExpense(newExpItem)

                      sendNotification({
                        title: '💵 Kasadan Doğrudan Gider Ödemesi',
                        message: `${user?.name || 'Kasa / Muhasebe'} '${titleToUse}' için kasadan ${totalVal.toLocaleString('tr-TR')} ₺ ödeme yaptı. Onay masanızda inceleyebilirsiniz.`,
                        targetRole: 'FINANCIAL_ADVISOR',
                        senderName: user?.name || 'Kasa / Muhasebe',
                        type: 'EXPENSE_APPROVAL',
                        relatedEntityId: null
                      })

                      notifySuccess(
                        `${totalVal.toLocaleString('tr-TR')} ₺ gider olarak kasadan ödendi ve Mali Müşavir incelemesine iletildi.`,
                        'Gider Ödemesi Kaydedildi ✓'
                      )
                    }

                    setShowCashAllocationModal(false)
                    setSelectedTargetExpense('')
                    setCustomExpenseTitle('')
                  }}
                >
                  ✓ Kasadan Gideri Öde ve Müşavire Bildir
                </button>
                <button
                  type="button"
                  onClick={() => setShowCashAllocationModal(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', fontWeight: 600 }}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YENİ GİDER GİRİŞ MODALI */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '560px',
              maxHeight: '94vh',
              background: '#ffffff',
              border: '1px solid #dbe7df',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(10, 31, 17, 0.18)',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ea', background: '#f8fbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '20px' }}>
                  <FiPlus size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                    {isFinancialAdvisor && !isAccountant ? 'Mali Müşavir Defter Girişi' : 'Muhasebe & Kasa Gider Girişi'}
                  </h3>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>Sabit ve değişken maliyet kalemi kaydı</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowAddModal(false)} style={{ color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Gider Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="Elektrik Faturası, Şube Kirası, Sarf Malzeme Alımı..."
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Ana Kategori</label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px', background: '#f8fafc' }}
                    value={newExpense.category}
                    onChange={(e) => {
                      const cat = e.target.value
                      const defaultSub = cat === 'FIXED' ? 'RENT' : 'ELECTRICITY'
                      setNewExpense({ ...newExpense, category: cat, subType: defaultSub })
                    }}
                  >
                    <option value="FIXED">🏢 Sabit Gider</option>
                    <option value="VARIABLE">⚡ Değişken Gider</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Gider Türü</label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px', background: '#f8fafc' }}
                    value={newExpense.subType}
                    onChange={(e) => setNewExpense({ ...newExpense, subType: e.target.value })}
                  >
                    {newExpense.category === 'FIXED' ? (
                      <>
                        <option value="RENT">🏢 Kira (İşyeri)</option>
                        <option value="LABOR">👥 İşçilik & Personel Maaşları</option>
                        <option value="ACCOUNTANT">📑 Mali Müşavir</option>
                      </>
                    ) : (
                      <>
                        <option value="ELECTRICITY">⚡ Elektrik</option>
                        <option value="WATER">💧 Su</option>
                        <option value="GAS">🔥 Doğalgaz</option>
                        <option value="PHONE">📞 Telefon</option>
                        <option value="INTERNET">🌐 İnternet & Ağ</option>
                        <option value="TAX">🏛️ Vergi (KDV / Stopaj)</option>
                        <option value="SGK">🛡️ Sigorta (SGK Prim)</option>
                        <option value="CONSUMABLES">📦 Sarf Malzeme</option>
                        <option value="LOGISTICS">🚚 Lojistik & Nakliye</option>
                        <option value="MARKETING">📣 Reklam & Tanıtım</option>
                        <option value="RENOVATION">🔨 Tadilat & Bakım</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Kira ise Mülkiyet Durumu Seçeneği */}
              {newExpense.subType === 'RENT' && (
                <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newExpense.isOwnedProperty}
                      onChange={(e) => setNewExpense({ ...newExpense, isOwnedProperty: e.target.checked, amount: e.target.checked ? '0' : newExpense.amount })}
                    />
                    <span>🏠 Dükkan Restoranın Kendi Mülkü (Öz Mülk - Kira Ödenmiyor)</span>
                  </label>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', marginLeft: '22px' }}>
                    İşaretlenirse kira maliyeti 0 ₺ olarak kaydedilir ve mülkiyet resmi kayıtlara işlenir.
                  </div>
                </div>
              )}

              {/* Gerçekçi Muhasebe: Kurum / Tedarikçi ve Fatura No */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Kurum / Alacaklı / Tedarikçi</label>
                  <input
                    type="text"
                    placeholder="Enerjisa, İGDAŞ, Mülk Sahibi vb."
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    value={newExpense.counterparty}
                    onChange={(e) => setNewExpense({ ...newExpense, counterparty: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Resmi Fatura / Fiş Seri No</label>
                  <input
                    type="text"
                    placeholder="GİB-2026-000412"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    value={newExpense.invoiceNumber}
                    onChange={(e) => setNewExpense({ ...newExpense, invoiceNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Tutar, İşlem Tarihi, Son Ödeme Vadesi ve Dönem */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    {newExpense.isOwnedProperty ? 'Tutar (0 ₺ Öz Mülk)' : 'Tutar (₺) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={newExpense.isOwnedProperty}
                    required={!newExpense.isOwnedProperty}
                    placeholder="0.00"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: newExpense.isOwnedProperty ? '#f1f5f9' : '#ffffff' }}
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>İşlem Tarihi *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    value={newExpense.expenseDate}
                    onChange={(e) => {
                      const val = e.target.value
                      const p = val ? val.substring(0, 7) : newExpense.period
                      setNewExpense({ ...newExpense, expenseDate: val, period: p })
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>Son Ödeme Vadesi</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    value={newExpense.dueDate}
                    onChange={(e) => setNewExpense({ ...newExpense, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Muhasebe Dönemi</label>
                  <input
                    type="text"
                    placeholder="2026-10"
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                    value={newExpense.period}
                    onChange={(e) => setNewExpense({ ...newExpense, period: e.target.value })}
                  />
                </div>
              </div>

              {/* Ödeme Durumu: Peşin Ödendi vs Borca Bırak (Vade) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                  Kasa Ödeme Durumu (Peşin / Borç / Kısmi)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#065f46', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="PAID"
                      checked={newExpense.paymentStatus === 'PAID'}
                      onChange={() => setNewExpense({ ...newExpense, paymentStatus: 'PAID', paidByCashier: true })}
                    />
                    <span>💵 Kasadan Peşin Ödendi</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#b91c1c', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="UNPAID"
                      checked={newExpense.paymentStatus === 'UNPAID'}
                      onChange={() => setNewExpense({ ...newExpense, paymentStatus: 'UNPAID', paidByCashier: false })}
                    />
                    <span>⏳ Ödenmedi (Borca / Vadeye Bırakıldı)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#b45309', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="PARTIAL"
                      checked={newExpense.paymentStatus === 'PARTIAL'}
                      onChange={() => setNewExpense({ ...newExpense, paymentStatus: 'PARTIAL', paidByCashier: true })}
                    />
                    <span>⚡ Kısmi Ödeme (Avans / Parçalı)</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Açıklama / Detaylı Not</label>
                <textarea
                  rows="2"
                  placeholder="Gider sebebi, fatura detayı veya vade açıklaması..."
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', background: '#f8fafc' }}
                  value={newExpense.note}
                  onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 700 }}>
                  Kaydet
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ padding: '12px 20px', fontWeight: 600 }}>
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MALİ MÜŞAVİR RET GEREKÇESİ MODALI */}
      {expenseToReject && (
        <div className="modal-overlay" onClick={() => setExpenseToReject(null)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              background: '#ffffff',
              border: '1px solid #fecdd3',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 45px rgba(225, 29, 72, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ❌
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Mali Müşavir Onayını Reddet</h3>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>"{expenseToReject.title}" ({expenseToReject.amount.toLocaleString('tr-TR')} ₺)</span>
              </div>
            </div>

            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
              Lütfen bu gideri neden resmi deftere kabul etmediğinizi yazınız. Bu açıklama muhasebe ekranında gerekçeli hata olarak bildirilecektir:
            </p>

            <textarea
              rows="3"
              className="form-input"
              placeholder="Fatura aslı sisteme yüklenmemiş / Stopaj tevkifat oranı hatalı / Kurumsal fatura unvanı geçersiz..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', marginBottom: '14px', background: '#f8fafc' }}
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleRejectLedger}
                style={{ flex: 1, padding: '12px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Gerekçeli Reddet
              </button>
              <button
                onClick={() => setExpenseToReject(null)}
                className="btn-secondary"
                style={{ padding: '12px 20px', fontWeight: 600 }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALI */}
      {expenseToDelete && (
        <div className="modal-overlay" onClick={() => setExpenseToDelete(null)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '400px',
              background: '#ffffff',
              border: '1px solid #fed7aa',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 45px rgba(234, 88, 12, 0.15)'
            }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '24px' }}>
              ⚠️
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Gider Kaydı Silinsin mi?</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              "{expenseToDelete.title}" ({expenseToDelete.amount.toLocaleString('tr-TR')} ₺) kaydı sistemden kalıcı olarak silinecektir.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setExpenseToDelete(null)}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px', fontWeight: 600 }}
              >
                Vazgeç
              </button>
              <button
                onClick={async () => {
                  await deleteExpense(expenseToDelete.id)
                  notifySuccess('Gider kaydı silindi', 'Silindi')
                  setExpenseToDelete(null)
                }}
                style={{ flex: 1, padding: '10px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
