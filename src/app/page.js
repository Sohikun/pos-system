"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Package, Plus, Receipt, History, Trash2, AlertTriangle, LogOut } from "lucide-react"
import Auth from "@/components/Auth"
import Inventory from "@/components/Inventory"
import Ticket from "@/components/Ticket"

const CustomDialog = ({ isOpen, onClose, onConfirm, title, description }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="mb-4">{description}</p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  // Authentication state
  const [token, setToken] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Shared state
  const [products, setProducts] = useState([])
  const [tickets, setTickets] = useState([])
  const [activeTicket, setActiveTicket] = useState(null)
  const [showTicket, setShowTicket] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showTicketHistory, setShowTicketHistory] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [notification, setNotification] = useState("")
  const [selectedProducts, setSelectedProducts] = useState([])
  const [showActionsDropdown, setShowActionsDropdown] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [tempImages, setTempImages] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTicketItems, setSelectedTicketItems] = useState([])
  const [showTicketActionsDropdown, setShowTicketActionsDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState("all")
  const [inventoryScannerBuffer, setInventoryScannerBuffer] = useState("")
  const itemsPerPage = 50
  const searchInputRef = useRef(null)
  const inventorySearchRef = useRef(null)
  const scannerInputRef = useRef(null)
  const inventoryScannerInputRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteAction, setDeleteAction] = useState(null)
  const [deleteCount, setDeleteCount] = useState(0)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    price: 0,
    cost: 0,
    sku: "",
    barcode: "",
    trackQuantity: false,
    quantity: 0,
    lowStock: 0,
    supplier: "",
    inventoryLocation: "",
  })

  // Check for token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchProducts(storedToken)
      fetchTickets(storedToken)
    }
  }, [])

  // Barcode scan handler for inventory view
  useEffect(() => {
    if (showTicket || !inventoryScannerInputRef.current) return

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const barcode = inventoryScannerInputRef.current.value.trim()
        if (barcode) {
          setSearchQuery(barcode)
          setCurrentPage(1)
          inventoryScannerInputRef.current.value = ""
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showTicket])

  const showNotification = (message) => {
    setNotification(message)
    setTimeout(() => setNotification(""), 3000)
  }

  const fetchProducts = async (token) => {
    if (!token) {
      console.warn("fetchProducts: No token provided, skipping API call")
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.message || `Failed to fetch products (Status: ${res.status})`
        if (errorMessage.includes("Invalid token")) {
          console.warn("fetchProducts: Invalid token detected, triggering logout")
          handleLogout()
          showNotification("Session expired. Please log in again.")
          return
        }
        // Log non-critical errors for debugging but don't show notification
        console.error("fetchProducts error:", errorMessage, { status: res.status, response: errorData })
        return
      }
      const data = await res.json()
      setProducts(data.reverse())
      setSelectedProducts([])
      setCurrentPage(1)
    } catch (error) {
      console.error("fetchProducts failed:", error.message, { error })
      if (error.message.includes("Invalid token")) {
        handleLogout()
        showNotification("Session expired. Please log in again.")
      }
      // Suppress notification for non-critical errors
    }
  }

  const fetchTickets = async (token) => {
    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || "Failed to fetch tickets")
      }
      const data = await res.json()
      setTickets(data)
    } catch (error) {
      showNotification(`Error fetching tickets: ${error.message}`)
      if (error.message.includes("Invalid token")) {
        handleLogout()
      }
    }
  }

  const handleLogin = (token, email, password) => {
    localStorage.setItem('token', token)
    setToken(token)
    setEmail("")
    setPassword("")
    fetchProducts(token)
    fetchTickets(token)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setProducts([])
    setTickets([])
    setActiveTicket(null)
    setShowTicket(false)
    setShowAddForm(false)
    setShowEditForm(false)
    setShowTicketHistory(false)
    setSelectedProducts([])
    setSelectedTicketItems([])
  }

  const getStockStatus = (product) => !product.trackQuantity ? { label: "Not Tracked", variant: "secondary" } : product.quantity === 0 ? { label: "Out of Stock", variant: "destructive" } : product.quantity <= product.lowStock ? { label: "Low Stock", variant: "yellow" } : { label: "In Stock", variant: "default" }

  const activeTickets = tickets.filter(t => t.status === 'active')
  const deductedTickets = tickets.filter(t => t.status === 'deducted')

  const createTicket = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) {
        const text = await res.text()
        let errorMessage = `Failed to create ticket (Status: ${res.status})`
        try {
          const errorData = JSON.parse(text)
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = `Server returned non-JSON response: ${text.slice(0, 50)}...`
        }
        throw new Error(errorMessage)
      }
      const { ticket } = await res.json()
      setTickets((prev) => [...prev, ticket])
      setActiveTicket(ticket._id)
      setShowTicket(true)
      setShowAddForm(false)
      setShowEditForm(false)
      setShowTicketHistory(false)
      showNotification(`Ticket #${ticket.ticketNumber} created`)
    } catch (error) {
      showNotification(`Error creating ticket: ${error.message}`)
    }
  }

  const confirmDelete = (action, count) => {
    setDeleteAction(() => action)
    setDeleteCount(count)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (deleteAction) try { await deleteAction() } catch (error) { showNotification(`Error deleting: ${error.message}`) }
    setShowDeleteConfirm(false)
    setDeleteAction(null)
    setDeleteCount(0)
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setDeleteAction(null)
    setDeleteCount(0)
  }

  const renderSidebar = () => (
    <div className="w-64 bg-gray-50 border-r p-4 space-y-4">
      <div className="flex items-center space-x-2 mb-6">
        <Package className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
      </div>
      <div className="space-y-2">
        <Button
          variant={!showTicket && !showAddForm && !showEditForm && !showTicketHistory ? "default" : "ghost"}
          className="w-full justify-start"
          onClick={() => {
            setShowTicket(false)
            setShowAddForm(false)
            setShowEditForm(false)
            setShowTicketHistory(false)
          }}
        >
          <Package className="mr-2 h-4 w-4" /> Inventory List
        </Button>
        {!showEditForm && (
          <Button
            variant={showAddForm ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => {
              setShowAddForm(true)
              setShowTicket(false)
              setShowTicketHistory(false)
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        )}
        <Button variant="ghost" className="w-full justify-start" onClick={createTicket}>
          <Receipt className="mr-2 h-4 w-4" /> New Ticket
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
      {activeTickets.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Tickets</h3>
          <div className="space-y-1">
            {activeTickets.map((ticket) => (
              <Button
                key={ticket._id}
                variant={activeTicket === ticket._id ? "default" : "ghost"}
                className="w-full justify-between text-sm"
                onClick={() => {
                  setActiveTicket(ticket._id)
                  setShowTicket(true)
                  setShowAddForm(false)
                  setShowEditForm(false)
                  setShowTicketHistory(false)
                }}
              >
                <span>Ticket #{ticket.ticketNumber}</span>
                <Badge variant="secondary">{ticket.items.length}</Badge>
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Separator />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Checked Out Tickets</h3>
        <div className="space-y-1">
          <Button
            variant={showTicketHistory ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => {
              setShowTicketHistory(true)
              setShowTicket(false)
              setShowAddForm(false)
              setShowEditForm(false)
            }}
          >
            <History className="mr-2 h-4 w-4" /> View History
          </Button>
          {deductedTickets.length > 0 && (
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600"
              onClick={() => confirmDelete(() => {
                (async () => {
                  try {
                    const res = await fetch(`${API_URL}/api/tickets/clear`, {
                      method: 'DELETE',
                      headers: { "Authorization": `Bearer ${token}` }
                    })
                    if (!res.ok) {
                      const text = await res.text()
                      let errorMessage = `Failed to clear deducted tickets (Status: ${res.status})`
                      try {
                        const errorData = JSON.parse(text)
                        errorMessage = errorData.message || errorMessage
                      } catch {
                        errorMessage = `Server returned non-JSON response: ${text.slice(0, 50)}...`
                      }
                      throw new Error(errorMessage)
                    }
                    const data = await res.json()
                    showNotification(data.message)
                    setTickets((prev) => prev.filter((t) => t.status !== 'deducted'))
                  } catch (error) {
                    showNotification(`Error clearing deducted tickets: ${error.message}`)
                  }
                })()
              }, deductedTickets.length)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear All Deducted
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {!token ? (
        <Auth onLogin={handleLogin} API_URL={API_URL} />
      ) : (
        <>
          {renderSidebar()}
          <div className="flex-1 p-6 relative">
            {notification && (
              <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
                <Alert className="max-w-md shadow-lg transition-opacity duration-300">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{notification}</AlertDescription>
                </Alert>
              </div>
            )}
            <style jsx>{`
              @keyframes slide-in-right {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              .animate-slide-in-right {
                animation: slide-in-right 0.3s ease-out;
              }
            `}</style>
            <CustomDialog
              isOpen={showDeleteConfirm}
              onClose={handleDeleteCancel}
              onConfirm={handleDeleteConfirm}
              title="Confirm Deletion"
              description={`Are you sure you want to delete ${deleteCount} ${deleteCount === 1 ? "item" : "items"}? This action cannot be undone.`}
            />
            {(!showTicket && !showTicketHistory) && (
              <Inventory
                products={products}
                setProducts={setProducts}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                showEditForm={showEditForm}
                setShowEditForm={setShowEditForm}
                editProduct={editProduct}
                setEditProduct={setEditProduct}
                formData={formData}
                setFormData={setFormData}
                selectedProducts={selectedProducts}
                setSelectedProducts={setSelectedProducts}
                showActionsDropdown={showActionsDropdown}
                setShowActionsDropdown={setShowActionsDropdown}
                imageFiles={imageFiles}
                setImageFiles={setImageFiles}
                tempImages={tempImages}
                setTempImages={setTempImages}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filter={filter}
                setFilter={setFilter}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                inventoryScannerBuffer={inventoryScannerBuffer}
                setInventoryScannerBuffer={setInventoryScannerBuffer}
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                deleteAction={deleteAction}
                setDeleteAction={setDeleteAction}
                deleteCount={deleteCount}
                setDeleteCount={setDeleteCount}
                API_URL={API_URL}
                showNotification={showNotification}
                fetchProducts={fetchProducts}
                getStockStatus={getStockStatus}
                itemsPerPage={itemsPerPage}
                inventorySearchRef={inventorySearchRef}
                inventoryScannerInputRef={inventoryScannerInputRef}
                token={token}
                handleLogout={handleLogout}
              />
            )}
            {(showTicket || showTicketHistory) && (
              <Ticket
                tickets={tickets}
                setTickets={setTickets}
                activeTicket={activeTicket}
                setActiveTicket={setActiveTicket}
                showTicket={showTicket}
                setShowTicket={setShowTicket}
                showTicketHistory={showTicketHistory}
                setShowTicketHistory={setShowTicketHistory}
                selectedTicketItems={selectedTicketItems}
                setSelectedTicketItems={setSelectedTicketItems}
                showTicketActionsDropdown={showTicketActionsDropdown}
                setShowTicketActionsDropdown={setShowTicketActionsDropdown}
                products={products}
                API_URL={API_URL}
                showNotification={showNotification}
                scannerInputRef={scannerInputRef}
                searchInputRef={searchInputRef}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}