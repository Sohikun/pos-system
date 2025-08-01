"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  X,
  Check,
  Edit,
  ImageIcon,
  AlertTriangle,
  Filter,
  Upload,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy
} from "lucide-react"

// Debounce utility to delay fetchProducts calls
const debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export default function Inventory({
  products,
  setProducts,
  showAddForm,
  setShowAddForm,
  showEditForm,
  setShowEditForm,
  editProduct,
  setEditProduct,
  formData,
  setFormData,
  selectedProducts,
  setSelectedProducts,
  showActionsDropdown,
  setShowActionsDropdown,
  imageFiles,
  setImageFiles,
  tempImages,
  setTempImages,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  currentPage,
  setCurrentPage,
  inventoryScannerBuffer,
  setInventoryScannerBuffer,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteAction,
  setDeleteAction,
  deleteCount,
  setDeleteCount,
  API_URL,
  showNotification,
  fetchProducts,
  getStockStatus,
  itemsPerPage,
  inventorySearchRef,
  inventoryScannerInputRef,
  token,
  handleLogout
}) {
  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id)

  // Debounced fetchProducts to prevent rapid calls
  const debouncedFetchProducts = debounce(fetchProducts, 500)

  const resetForm = () => {
    setFormData({
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
    setImageFiles([])
    setTempImages([])
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    const totalImages = (editProduct?.images?.length || 0) + files.length
    if (totalImages > 5) {
      showNotification("Maximum 5 images allowed")
      return
    }
    setImageFiles(files)
  }

  const handleSelectProduct = (productId, checked) => {
    setSelectedProducts((prev) => (checked ? [...prev, productId] : prev.filter((id) => id !== productId)))
  }

  const handleSelectAll = (checked) => (checked ? setSelectedProducts(filteredProducts.map((p) => p._id)) : setSelectedProducts([]))

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

  const copyToClipboard = (text) => navigator.clipboard.writeText(text).then(() => showNotification("Barcode copied to clipboard"), () => showNotification("Failed to copy barcode"))

  const addProduct = async (e) => {
    e.preventDefault()
    const formDataToSend = new FormData()
    for (const key in formData) if ((key !== "sku" || formData[key]) && (key !== "barcode" || formData[key])) formDataToSend.append(key, formData[key])
    imageFiles.forEach((file) => formDataToSend.append("images", file))
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formDataToSend
      })
      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.message.includes("Invalid token")) {
          handleLogout()
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(errorData.message || "Failed to add product")
      }
      const data = await res.json()
      // Optimistically update the products state
      setProducts((prev) => [data.product, ...prev])
      setShowAddForm(false)
      resetForm()
      showNotification(data.message)
      // Sync with backend using debounced fetch
      debouncedFetchProducts(token)
    } catch (error) {
      showNotification(`Error adding product: ${error.message}`)
    }
  }

  const updateProduct = async (e) => {
    e.preventDefault()
    const formDataToSend = new FormData()
    for (const key in formData) if ((key !== "sku" || formData[key]) && (key !== "barcode" || formData[key])) formDataToSend.append(key, formData[key])
    const existingImages = editProduct?.images || []
    const totalImages = existingImages.length + imageFiles.length
    if (totalImages > 5) {
      showNotification("Maximum 5 images allowed")
      return
    }
    existingImages.forEach((image) => formDataToSend.append("existingImages", image))
    imageFiles.forEach((file) => formDataToSend.append("images", file))
    try {
      const res = await fetch(`${API_URL}/api/products/${editProduct._id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
        body: formDataToSend
      })
      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.message.includes("Invalid token")) {
          handleLogout()
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(errorData.message || "Failed to update product")
      }
      const data = await res.json()
      // Optimistically update the products state
      setProducts((prevProducts) => prevProducts.map((p) => (p._id === editProduct._id ? data.product : p)))
      setShowEditForm(false)
      setEditProduct(null)
      resetForm()
      showNotification(data.message || "Product updated")
      // Sync with backend using debounced fetch
      debouncedFetchProducts(token)
    } catch (error) {
      showNotification(`Error updating product: ${error.message}`)
    }
  }

  const editProductHandler = (product) => {
    setEditProduct(product)
    setFormData({
      title: product.title,
      description: product.description || "",
      category: product.category,
      price: product.price || 0,
      cost: product.cost || 0,
      sku: product.sku || "",
      barcode: product.barcode || "",
      trackQuantity: product.trackQuantity,
      quantity: product.quantity || 0,
      lowStock: product.lowStock || 0,
      supplier: product.supplier || "",
      inventoryLocation: product.inventoryLocation || "",
    })
    setImageFiles([])
    setTempImages(product.images || [])
    setShowEditForm(true)
  }

  const deleteSelectedProducts = async () => {
    if (selectedProducts.length === 0) {
      showNotification("No products selected")
      return
    }
    if (!selectedProducts.every(isValidObjectId)) {
      showNotification("One or more product IDs are invalid")
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/products/delete-multiple`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedProducts })
      })
      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.message.includes("Invalid token")) {
          handleLogout()
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(errorData.message || "Failed to delete products")
      }
      const data = await res.json()
      // Optimistically update the products state
      setProducts((prev) => prev.filter((p) => !selectedProducts.includes(p._id)))
      setSelectedProducts([])
      showNotification(data.message)
      // Sync with backend using debounced fetch
      debouncedFetchProducts(token)
    } catch (error) {
      showNotification(`Error deleting products: ${error.message}`)
    }
    setShowActionsDropdown(false)
  }

  const deleteSingleProduct = async (productId) => {
    if (!isValidObjectId(productId)) {
      showNotification("Invalid product ID")
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/products/delete-multiple`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ids: [productId] })
      })
      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.message.includes("Invalid token")) {
          handleLogout()
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(errorData.message || "Failed to delete product")
      }
      const data = await res.json()
      // Optimistically update the products state
      setProducts((prev) => prev.filter((p) => p._id !== productId))
      setShowEditForm(false)
      setEditProduct(null)
      showNotification(data.message)
      // Sync with backend using debounced fetch
      debouncedFetchProducts(token)
    } catch (error) {
      showNotification(`Error deleting product: ${error.message}`)
    }
  }

  const deleteImage = async (productId, imageName) => {
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/image/${imageName}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) {
        const errorData = await res.json()
        if (errorData.message.includes("Invalid token")) {
          handleLogout()
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(errorData.message || "Failed to delete image")
      }
      const data = await res.json()
      showNotification(data.message)
      setTempImages((prev) => prev.filter((img) => img !== imageName))
      // Sync with backend using debounced fetch
      debouncedFetchProducts(token)
    } catch (error) {
      showNotification(`Error deleting image: ${error.message}`)
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesFilter = filter === "low" ? p.trackQuantity && p.quantity <= p.lowStock : filter === "out" ? p.trackQuantity && p.quantity === 0 : true
    if (!searchQuery) return matchesFilter
    const normalizeString = (str) => str.toLowerCase().replace(/[-_\s]+/g, " ").trim()
    const queryTerms = normalizeString(searchQuery).split(" ")
    const title = normalizeString(p.title)
    const barcode = p.barcode ? normalizeString(p.barcode) : ""
    return matchesFilter && queryTerms.every((term) => title.includes(term) || (p.barcode && (p.barcode.toLowerCase() === searchQuery.toLowerCase() || barcode.includes(term))))
  }).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totalPages = Math.ceil(products.length / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, products.length)

  const handleInventorySearch = (value) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const renderProductForm = (isEdit = false) => (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEdit ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {isEdit ? "Edit Product" : "Add New Product"}
        </CardTitle>
        <CardDescription>
          {isEdit ? "Update product information and manage images" : "Create a new product in your inventory"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={isEdit ? updateProduct : addProduct} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Product Title *</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleInputChange} placeholder="Enter product title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" value={formData.category} onChange={handleInputChange} placeholder="Enter category" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (Rs)</Label>
                  <Input id="price" name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost (Rs)</Label>
                  <Input id="cost" name="cost" type="number" value={formData.cost} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} placeholder="Enter SKU" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" name="barcode" value={formData.barcode} onChange={handleInputChange} onKeyPress={(e) => { if (e.key === "Enter") e.preventDefault() }} placeholder="Enter or scan barcode" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Enter product description" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" value={formData.supplier} onChange={handleInputChange} placeholder="Enter supplier" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inventoryLocation">Location</Label>
                  <Input id="inventoryLocation" name="inventoryLocation" value={formData.inventoryLocation} onChange={handleInputChange} placeholder="Storage location" />
                </div>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="trackQuantity" checked={formData.trackQuantity} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, trackQuantity: checked }))} />
              <Label htmlFor="trackQuantity">Track inventory quantity</Label>
            </div>
            {formData.trackQuantity && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Current Quantity</Label>
                  <Input id="quantity" name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} placeholder="0" min="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowStock">Low Stock Alert</Label>
                  <Input id="lowStock" name="lowStock" type="number" value={formData.lowStock} onChange={handleInputChange} placeholder="0" min="0" />
                </div>
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-4">
            <Label className="text-base font-medium">Product Images</Label>
            {isEdit && tempImages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Current Images</Label>
                <div className="flex flex-wrap gap-3">
                  {tempImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <a href={`${API_URL}/Uploads/${image}`} target="_blank" rel="noopener noreferrer">
                        <img
                          src={`${API_URL}/Uploads/${image}`}
                          alt={`Product ${index}`}
                          className="w-20 h-20 object-cover border rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onError={(e) => { console.error(`Image load failed for ${image}:`, e); e.target.src = "/placeholder.svg?height=80&width=80" }}
                        />
                      </a>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteImage(editProduct._id, image)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="images" className="text-sm">{isEdit ? "Add New Images" : "Upload Images"} (up to 5)</Label>
              <div className="flex items-center space-x-2">
                <Input id="images" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} className="flex-1" />
                <Upload className="h-4 w-4 text-gray-400" />
              </div>
              {imageFiles.length > 0 && (
                <div className="text-sm text-gray-600">
                  <p className="font-medium">Selected files:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {imageFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isEdit) {
                  setShowEditForm(false)
                  setEditProduct(null)
                } else {
                  setShowAddForm(false)
                }
                resetForm()
              }}
            >
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            {isEdit && (
              <Button type="button" variant="destructive" onClick={() => confirmDelete(() => deleteSingleProduct(editProduct._id), 1)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Product
              </Button>
            )}
            <Button type="submit">
              <Check className="mr-2 h-4 w-4" /> {isEdit ? "Update Product" : "Save Product"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )

  const renderInventoryList = () => (
    <div className="space-y-6">
      <input
        ref={inventoryScannerInputRef}
        type="text"
        className="absolute w-0 h-0 opacity-0"
        style={{ position: "absolute", left: "-9999px" }}
      />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">MapStack</h2>
          <p className="text-gray-600">Manage your products and track inventory levels</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  ref={inventorySearchRef}
                  value={searchQuery}
                  onChange={(e) => handleInventorySearch(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleInventorySearch(e.target.value)
                    }
                  }}
                  placeholder="Search by name or barcode..."
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu open={showActionsDropdown} onOpenChange={setShowActionsDropdown}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreVertical className="h-4 w-4 mr-2" />
                    Actions
                    {selectedProducts.length > 0 && <Badge variant="secondary" className="ml-2">{selectedProducts.length}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => confirmDelete(deleteSelectedProducts, selectedProducts.length)} disabled={selectedProducts.length === 0} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedProducts([])} disabled={selectedProducts.length === 0}>
                    <X className="mr-2 h-4 w-4" /> Clear Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {filteredProducts.length === 0 && searchQuery && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>No products match your search criteria.</AlertDescription>
            </Alert>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Image</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product)
                  return (
                    <TableRow key={product._id} className="cursor-pointer hover:bg-gray-50" onClick={() => editProductHandler(product)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedProducts.includes(product._id)} onCheckedChange={(checked) => handleSelectProduct(product._id, checked)} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.title}</div>
                          {product.sku && <div className="text-sm text-gray-500">SKU: {product.sku}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{product.category && <Badge variant="outline">{product.category}</Badge>}</TableCell>
                      <TableCell>{product.trackQuantity ? product.quantity : "N/A"}</TableCell>
                      <TableCell className="flex items-center">
                        <Badge variant={stockStatus.variant} className="mr-4">{stockStatus.label}</Badge>
                        {product.barcode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(product.barcode)
                            }}
                            title="Copy barcode"
                            className="ml-auto"
                          >
                            <ClipboardCopy className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>Rs {(product.price || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {product.images?.length > 0 ? (
                          <img
                            src={`${API_URL}/Uploads/${product.images[0]}`}
                            alt="Product"
                            className="w-10 h-10 object-cover border rounded"
                            onError={(e) => { console.error(`Image load failed for ${product.images[0]}:`, e); e.target.src = "/placeholder.svg?height=40&width=40" }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 border rounded flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {products.length > itemsPerPage && (
              <div className="flex justify-start mt-4">
                <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)} className="mr-2">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">{` ${startItem}-${endItem} of ${products.length} `}</span>
                <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => prev + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <>
      {showAddForm ? renderProductForm(false) : showEditForm ? renderProductForm(true) : renderInventoryList()}
    </>
  )
}