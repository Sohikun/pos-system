"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Search, ShoppingCart, Receipt, History, Plus, Minus, MoreVertical, Trash2, X, Check } from "lucide-react"

export default function Ticket({
  tickets,
  setTickets,
  activeTicket,
  setActiveTicket,
  showTicket,
  setShowTicket,
  showTicketHistory,
  setShowTicketHistory,
  selectedTicketItems,
  setSelectedTicketItems,
  showTicketActionsDropdown,
  setShowTicketActionsDropdown,
  products,
  API_URL,
  showNotification,
  scannerInputRef,
  searchInputRef
}) {
  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id)

  const updateTicketInBackend = async (ticketId, items) => {
    try {
      if (!isValidObjectId(ticketId)) {
        throw new Error('Invalid ticket ID')
      }
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ items })
      })
      const text = await res.text()
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error(`Non-JSON response from updateTicketInBackend: ${text.slice(0, 100)}...`, parseError)
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 50)}...`)
      }
      if (!res.ok) {
        throw new Error(data.message || `Failed to update ticket items (Status: ${res.status})`)
      }
      return data.ticket
    } catch (error) {
      showNotification(`Error updating ticket items: ${error.message}`)
      return null
    }
  }

  const getReservedQuantity = (productId, excludeTicketId = null) => {
    return tickets
      .filter(t => t.status === 'active')
      .reduce((total, ticket) => {
        if (excludeTicketId && ticket._id === excludeTicketId) return total
        return total + (ticket.items.find((item) => item.productId.toString() === productId)?.quantity || 0)
      }, 0)
  }

  const addToTicket = async (ticketId, product, quantity = 1) => {
    const productData = products.find((p) => p._id === product._id)
    if (!productData.trackQuantity) {
      showNotification(`Product ${product.title} does not track quantity`)
      return
    }
    const reserved = getReservedQuantity(product._id, ticketId)
    const currentItem = tickets.find(t => t._id === ticketId)?.items.find(i => i.productId.toString() === product._id)
    const currentQuantity = currentItem ? currentItem.quantity : 0
    const available = productData.quantity - reserved
    const newQuantity = currentQuantity + quantity
    if (newQuantity > available) {
      showNotification(`Not enough stock for ${product.title}. Available: ${available}`)
      return
    }
    setTickets((prev) => {
      const updatedTickets = prev.map((ticket) => {
        if (ticket._id === ticketId) {
          const existing = ticket.items.find((item) => item.productId.toString() === product._id)
          const updatedItems = existing
            ? ticket.items.map((item) =>
                item.productId.toString() === product._id ? { ...item, quantity: newQuantity } : item
              )
            : [...ticket.items, { productId: product._id, title: product.title, quantity: newQuantity, price: product.price || 0 }]
          updateTicketInBackend(ticketId, updatedItems)
          showNotification(`${product.title} ${existing ? 'updated in' : 'added to'} ticket`)
          return { ...ticket, items: updatedItems }
        }
        return ticket
      })
      return updatedTickets
    })
  }

  const updateTicketItemQuantity = async (ticketId, productId, change) => {
    const productData = products.find((p) => p._id === productId)
    if (!productData.trackQuantity) {
      showNotification(`Product ${productData.title} does not track quantity`)
      return
    }
    const reserved = getReservedQuantity(productId, ticketId)
    setTickets((prev) => {
      const updatedTickets = prev.map((ticket) => {
        if (ticket._id === ticketId) {
          const existing = ticket.items.find((item) => item.productId.toString() === productId)
          if (!existing) return ticket
          const newQuantity = existing.quantity + change
          const available = productData.quantity - reserved
          if (newQuantity < 1) {
            const updatedItems = ticket.items.filter((item) => item.productId.toString() !== productId)
            updateTicketInBackend(ticketId, updatedItems)
            showNotification(`Removed ${productData.title} from ticket`)
            return { ...ticket, items: updatedItems }
          }
          if (newQuantity > available) {
            showNotification(`Not enough stock for ${productData.title}. Available: ${available}`)
            return ticket
          }
          const updatedItems = ticket.items.map((item) =>
            item.productId.toString() === productId ? { ...item, quantity: newQuantity } : item
          )
          updateTicketInBackend(ticketId, updatedItems)
          showNotification(`Updated ${productData.title} quantity to ${newQuantity}`)
          return { ...ticket, items: updatedItems }
        }
        return ticket
      })
      return updatedTickets
    })
  }

  const deductItems = async () => {
    const activeTicketData = tickets.find((t) => t._id === activeTicket)
    if (!activeTicketData?.items.length) {
      showNotification("No items in ticket")
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/tickets/deduct-many`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ items: activeTicketData.items, ticketId: activeTicket })
      })
      if (!res.ok) {
        const text = await res.text()
        let errorMessage = `Failed to deduct items (Status: ${res.status})`
        try {
          const errorData = JSON.parse(text)
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = `Server returned non-JSON response: ${text.slice(0, 50)}...`
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      showNotification(`Deducted: ${data.updatedProducts.map((p) => `${p.title} x ${p.deducted}`).join(", ")}`)
      setTickets((prev) => prev.map((t) => t._id === activeTicket ? data.ticket : t))
      setActiveTicket(null)
      setShowTicket(false)
    } catch (error) {
      showNotification(`Error deducting items: ${error.message}`)
    }
  }

  const closeTicket = async () => {
    if (!activeTicket) {
      showNotification("No active ticket selected")
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/tickets/${activeTicket}`, {
        method: 'DELETE',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!res.ok) {
        const text = await res.text()
        let errorMessage = `Failed to close ticket (Status: ${res.status})`
        try {
          const errorData = JSON.parse(text)
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = `Server returned non-JSON response: ${text.slice(0, 50)}...`
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      setTickets((prev) => prev.filter((t) => t._id !== activeTicket))
      setActiveTicket(null)
      setShowTicket(false)
      showNotification(data.message || "Ticket closed")
    } catch (error) {
      showNotification(`Error closing ticket: ${error.message}`)
    }
  }

  const deleteSelectedTicketItems = async () => {
    if (selectedTicketItems.length === 0) {
      showNotification("No items selected")
      return
    }
    setTickets((prev) => {
      const updatedTickets = prev.map((ticket) => {
        if (ticket._id === activeTicket) {
          const updatedItems = ticket.items.filter((item) => !selectedTicketItems.includes(item.productId.toString()))
          updateTicketInBackend(ticket._id, updatedItems)
          return { ...ticket, items: updatedItems }
        }
        return ticket
      })
      return updatedTickets
    })
    setSelectedTicketItems([])
    setShowTicketActionsDropdown(false)
    showNotification("Selected items removed from ticket")
  }

  const handleSearchChange = (ticketId, value) => {
    setTickets((prev) => prev.map((ticket) => ticket._id === ticketId ? { ...ticket, searchQuery: value } : ticket))
  }

  const handleBarcodeScan = (ticketId, barcode) => {
    if (!activeTicket) {
      showNotification("Please select or create a ticket first")
      return
    }
    const product = products.find((p) => p.barcode === barcode)
    if (product) {
      addToTicket(ticketId, product)
      setTickets((prev) => prev.map((ticket) => ticket._id === ticketId ? { ...ticket, searchQuery: "" } : ticket))
    } else {
      showNotification("Product not found")
    }
  }

  const handleSelectTicketItem = (productId, checked) => {
    setSelectedTicketItems((prev) => (checked ? [...prev, productId] : prev.filter((id) => id !== productId)))
  }

  const handleSelectAllTicketItems = (checked) => {
    setSelectedTicketItems(checked ? (activeTicketData?.items.map((item) => item.productId.toString()) || []) : [])
  }

  const activeTicketData = tickets.find((t) => t._id === activeTicket)
  const deductedTickets = tickets.filter((t) => t.status === 'deducted')
  const searchedProducts = activeTicketData ? products.filter((p) => {
    const normalizeString = (str) => str.toLowerCase().replace(/[-_\s]+/g, " ").trim()
    const queryTerms = normalizeString(activeTicketData.searchQuery || "").split(" ")
    const title = normalizeString(p.title)
    return queryTerms.every((term) => title.includes(term))
  }) : []

  const calculateTicketTotal = () => (activeTicketData ? activeTicketData.items.reduce((total, item) => {
    const product = products.find((p) => p._id === item.productId.toString())
    return total + (product ? (product.price || 0) * item.quantity : 0)
  }, 0) : 0)

  useEffect(() => {
    if (showTicket && searchInputRef.current) searchInputRef.current.focus()
  }, [showTicket, activeTicket])

  useEffect(() => {
    if (!showTicket || !scannerInputRef.current) return

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && (document.activeElement === scannerInputRef.current || document.activeElement === document.body)) {
        e.preventDefault()
        const barcode = scannerInputRef.current.value.trim()
        if (barcode) {
          handleBarcodeScan(activeTicket, barcode)
          scannerInputRef.current.value = ""
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showTicket, activeTicket])

  const renderTicketView = () => (
    <div className="space-y-6">
      <input
        ref={scannerInputRef}
        type="text"
        className="absolute w-0 h-0 opacity-0"
        style={{ position: "absolute", left: "-9999px" }}
      />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Ticket #{activeTicketData?.ticketNumber}</h2>
          <p className="text-gray-600">{activeTicketData?.items.length || 0} items • Total: Rs {calculateTicketTotal().toFixed(2)}</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={deductItems} disabled={!activeTicketData?.items.length}>
            <Check className="mr-2 h-4 w-4" /> Deduct & Confirm
          </Button>
          <Button variant="outline" onClick={closeTicket}>
            <X className="mr-2 h-4 w-4" /> Close Ticket
          </Button>
          <DropdownMenu open={showTicketActionsDropdown} onOpenChange={setShowTicketActionsDropdown}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4 mr-2" />
                Actions
                {selectedTicketItems.length > 0 && <Badge variant="secondary" className="ml-2">{selectedTicketItems.length}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => deleteSelectedTicketItems()} disabled={selectedTicketItems.length === 0} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedTicketItems([])} disabled={selectedTicketItems.length === 0}>
                <X className="mr-2 h-4 w-4" /> Clear Selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Product Search
          </CardTitle>
          <CardDescription>Scan barcode or search for products to add to ticket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              value={activeTicketData?.searchQuery || ""}
              onChange={(e) => handleSearchChange(activeTicket, e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeScan(activeTicket, e.target.value)
                  e.target.value = ""
                }
              }}
              placeholder="Scan barcode or search products..."
              className="pl-10"
            />
          </div>
          {activeTicketData?.searchQuery && (
            <div className="mt-4 max-h-48 overflow-y-auto border rounded-lg">
              {searchedProducts.map((product) => (
                <div
                  key={product._id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                  onClick={() => addToTicket(activeTicket, product)}
                >
                  <div>
                    <div className="font-medium">{product.title}</div>
                    <div className="text-sm text-gray-500">Stock: {product.trackQuantity ? product.quantity : "N/A"} • Rs {(product.price || 0).toFixed(2)}</div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Cart Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activeTicketData?.items.length ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No items in cart</p>
              <p className="text-sm">Search for products above to add them to this ticket</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTicketItems.length === activeTicketData.items.length && activeTicketData.items.length > 0}
                        onCheckedChange={handleSelectAllTicketItems}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Stock Status</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTicketData.items.map((item) => {
                    const product = products.find((p) => p._id === item.productId.toString())
                    const itemTotal = product ? ((product.price || 0) * item.quantity).toFixed(2) : "N/A"
                    const currentStock = product && product.trackQuantity ? product.quantity : null
                    const stockAfterDeduction = currentStock !== null ? currentStock - item.quantity : null
                    const stockDisplay = product && product.trackQuantity ? `${currentStock} > ${stockAfterDeduction}` : "N/A"
                    return (
                      <TableRow key={item.productId}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTicketItems.includes(item.productId.toString())}
                            onCheckedChange={(checked) => handleSelectTicketItem(item.productId.toString(), checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateTicketItemQuantity(activeTicket, item.productId.toString(), -1)
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span>{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateTicketItemQuantity(activeTicket, item.productId.toString(), 1)
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{stockDisplay}</TableCell>
                        <TableCell className="text-right">Rs {(product?.price || 0).toFixed(2) || "N/A"}</TableCell>
                        <TableCell className="text-right font-medium">Rs {itemTotal}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <div className="text-lg font-bold">Total: Rs {calculateTicketTotal().toFixed(2)}</div>
                  <div className="text-sm text-gray-500">{activeTicketData.items.length} items</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderTicketHistory = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Ticket History</h2>
          <p className="text-gray-600">View all deducted tickets and their items</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          {deductedTickets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No deducted tickets</p>
              <p className="text-sm">Deduct items from active tickets to see them here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {deductedTickets.map((ticket) => (
                <div key={ticket._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Ticket #{ticket.ticketNumber}</h3>
                      <p className="text-sm text-gray-500">
                        Deducted on {new Date(ticket.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary">{ticket.items.length} items</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ticket.items.map((item) => {
                        const product = products.find((p) => p._id === item.productId.toString())
                        const itemTotal = product ? ((product.price || 0) * item.quantity).toFixed(2) : "N/A"
                        return (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.title}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">Rs {(product?.price || 0).toFixed(2) || "N/A"}</TableCell>
                            <TableCell className="text-right font-medium">Rs {itemTotal}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <>
      {showTicket ? renderTicketView() : showTicketHistory ? renderTicketHistory() : null}
    </>
  )
}