'use client'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DialogHeader } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

// Types for product creation
type CreateProductProperties = {
    name: string
    description: string | null
    minutes_included: number
    price_per_minute_cents: number
    base_price_cents: number
    currency: string
    billing_period: string
    trial_days: number
}

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string): string => {
    switch (currency) {
        case 'USD':
            return '$'
        case 'EUR':
            return '€'
        case 'GBP':
            return '£'
        default:
            return '$'
    }
}

export default function CreateNewProduct() {
    const [isOpen, setIsOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const router = useRouter()
    const [formData, setFormData] = useState<CreateProductProperties>({
        name: '',
        description: '',
        minutes_included: 0,
        price_per_minute_cents: 0,
        base_price_cents: 0,
        currency: 'GBP',
        billing_period: 'month',
        trial_days: 0
    })

    // Display values as strings to preserve decimal input state
    const [displayPrices, setDisplayPrices] = useState({
        base_price_dollars: '',
        price_per_minute_dollars: ''
    })

    // Economic breakdown state - store as string for better input handling
    const [averageCostPerMinuteInput, setAverageCostPerMinuteInput] = useState('')
    const [minutesUsed, setMinutesUsed] = useState([0])
    
    // Convert string inputs to numbers for calculations
    const basePriceDollars = parseFloat(displayPrices.base_price_dollars) || 0
    const pricePerMinuteDollars = parseFloat(displayPrices.price_per_minute_dollars) || 0
    const averageCostPerMinute = parseFloat(averageCostPerMinuteInput) || 0

    // Reset slider to minutes_included when it changes
    useEffect(() => {
        setMinutesUsed([formData.minutes_included])
    }, [formData.minutes_included])

    // Economic calculations
    const pricePerIncludedMinute = formData.minutes_included > 0 
        ? basePriceDollars / formData.minutes_included 
        : 0
    
    const creditGranted = formData.minutes_included * pricePerMinuteDollars
    
    const currentMinutesUsed = minutesUsed[0]
    
    // Unit economics for one additional minute
    const unitRevenue = pricePerMinuteDollars
    const unitCost = averageCostPerMinute
    const unitProfit = unitRevenue - unitCost
    
    // Total cost and revenue calculations
    const totalDirectCost = currentMinutesUsed * averageCostPerMinute
    const totalRevenue = currentMinutesUsed <= formData.minutes_included 
        ? basePriceDollars 
        : basePriceDollars + ((currentMinutesUsed - formData.minutes_included) * pricePerMinuteDollars)
    
    // Processing fee calculation: 2% of total revenue + 20 cents
    const totalProcessingFees = (totalRevenue * 0.02) + 0.20
    const totalCost = totalDirectCost + totalProcessingFees
    
    const profit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

    // Overage calculations
    const overageMinutes = Math.max(0, currentMinutesUsed - formData.minutes_included)
    const overageValue = overageMinutes * pricePerMinuteDollars

    const handleInputChange = (field: keyof CreateProductProperties, value: string | number | null) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handlePriceChange = (field: 'base_price_dollars' | 'price_per_minute_dollars', value: string) => {
        // Allow empty string, numbers with decimals, and handle leading zeros
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setDisplayPrices(prev => ({
                ...prev,
                [field]: value
            }))

            // Convert to cents for storage
            const numValue = parseFloat(value) || 0
            const centsValue = Math.round(numValue * 100)

            if (field === 'base_price_dollars') {
                setFormData(prev => ({
                    ...prev,
                    base_price_cents: centsValue
                }))
            } else {
                setFormData(prev => ({
                    ...prev,
                    price_per_minute_cents: centsValue
                }))
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.name.trim()) {
            toast.error("Product name is required")
            return
        }

        setIsCreating(true)
        try {
            // TODO: Implement createProduct API call
            // await createProduct(formData)
            console.log('Product data to be submitted:', formData)
            toast.success("Product created successfully!")
            router.refresh()
            setIsOpen(false)
            // Reset form
            setFormData({
                name: '',
                description: '',
                minutes_included: 0,
                price_per_minute_cents: 0,
                base_price_cents: 0,
                currency: 'GBP',
                billing_period: 'month',
                trial_days: 0
            })
            setDisplayPrices({
                base_price_dollars: '',
                price_per_minute_dollars: ''
            })
            setAverageCostPerMinuteInput('')
            setMinutesUsed([0])
        } catch (error) {
            console.error('Error creating product:', error)
            if (error instanceof Error) {
                // Handle specific error messages from the server
                if (error.message.includes('Stripe')) {
                    toast.error("Stripe integration error. Please check your Stripe configuration.")
                } else if (error.message.includes('Organization not found')) {
                    toast.error("Organization not found. Please try refreshing the page.")
                } else if (error.message.includes('Failed to create product')) {
                    toast.error("Failed to save product to database. Please try again.")
                } else {
                    toast.error(`Failed to create product: ${error.message}`)
                }
            } else {
                toast.error("An unexpected error occurred. Please try again.")
            }
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>Create New Product</Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] !max-w-[1400px] max-h-[95vh] overflow-hidden" style={{ width: '90vw', maxWidth: '1400px' }}>
                <DialogHeader>
                    <DialogTitle>Create New Product</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Main Form */}
                        <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">Product Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g. Basic Plan"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                disabled={isCreating}
                                required
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Brief description of your product (optional)"
                                value={formData.description || ''}
                                    onChange={(e) => handleInputChange('description', e.target.value || null)}
                                disabled={isCreating}
                                rows={2}
                                className="resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="currency" className="text-sm font-medium">Currency</Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(value) => handleInputChange('currency', value)}
                                    disabled={isCreating}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="minutes_included" className="text-sm font-medium">Minutes Included</Label>
                                <Input
                                    id="minutes_included"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formData.minutes_included}
                                    onChange={(e) => handleInputChange('minutes_included', parseInt(e.target.value) || 0)}
                                    disabled={isCreating}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="trial_days" className="text-sm font-medium">Trial Days</Label>
                                <Input
                                    id="trial_days"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formData.trial_days}
                                    onChange={(e) => handleInputChange('trial_days', parseInt(e.target.value) || 0)}
                                    disabled={isCreating}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="billing_period" className="text-sm font-medium">Billing Period</Label>
                            <Select
                                value={formData.billing_period}
                                onValueChange={(value) => handleInputChange('billing_period', value)}
                                disabled={isCreating}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Daily</SelectItem>
                                    <SelectItem value="week">Weekly</SelectItem>
                                    <SelectItem value="month">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Pricing</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="base_price_dollars" className="text-xs text-muted-foreground">Base Price</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">{getCurrencySymbol(formData.currency)}</span>
                                        <Input
                                            id="base_price_dollars"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={displayPrices.base_price_dollars}
                                            onChange={(e) => handlePriceChange('base_price_dollars', e.target.value)}
                                            disabled={isCreating}
                                            className="pl-8 h-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="price_per_minute_dollars" className="text-xs text-muted-foreground">Per Minute</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">{getCurrencySymbol(formData.currency)}</span>
                                        <Input
                                            id="price_per_minute_dollars"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={displayPrices.price_per_minute_dollars}
                                            onChange={(e) => handlePriceChange('price_per_minute_dollars', e.target.value)}
                                            disabled={isCreating}
                                            className="pl-8 h-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* Right Column - Economic Breakdown */}
                        <div className="space-y-3 lg:border-l lg:border-border lg:pl-6">
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                                    <h3 className="text-lg font-semibold text-foreground">Economic Analysis</h3>
                                </div>

                                {/* Average Cost Per Minute Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="avg_cost_per_minute" className="text-sm font-medium">
                                        Average Cost Per Minute
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                                            {getCurrencySymbol(formData.currency)}
                                        </span>
                                        <Input
                                            id="avg_cost_per_minute"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={averageCostPerMinuteInput}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                // Allow empty string, numbers with decimals
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    setAverageCostPerMinuteInput(value)
                                                }
                                            }}
                                            disabled={isCreating}
                                            className="pl-8 h-10"
                                        />
                                    </div>
                                </div>

                                {/* Pricing Insights */}
                                <div className="p-2 bg-muted/30 rounded-lg border">
                                    <h4 className="font-medium text-sm mb-1 text-foreground">Pricing Insights</h4>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Price per Included Minute</span>
                                            <span className="text-sm font-semibold">
                                                {getCurrencySymbol(formData.currency)}{pricePerIncludedMinute.toFixed(4)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Credit Granted</span>
                                            <span className="text-sm font-semibold">
                                                {getCurrencySymbol(formData.currency)}{creditGranted.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Usage Simulation */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <Label className="text-sm font-medium">Usage Simulation</Label>
                                        <div className="flex items-start space-x-4">
                                            {/* Main Minutes Display */}
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-foreground">{currentMinutesUsed}</div>
                                                <div className="text-xs text-muted-foreground">minutes</div>
                                            </div>
                                            {/* Overage Info - Always takes space but conditionally visible */}
                                            <div className="text-right min-w-[80px]">
                                                <div className={`text-xs ${currentMinutesUsed > formData.minutes_included ? 'text-foreground' : 'text-transparent'}`}>
                                                    +{overageMinutes} overage
                                                </div>
                                                <div className={`text-xs font-semibold ${currentMinutesUsed > formData.minutes_included ? 'text-blue-600 dark:text-blue-400' : 'text-transparent'}`}>
                                                    {getCurrencySymbol(formData.currency)}{overageValue.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Slider
                                            value={minutesUsed}
                                            onValueChange={setMinutesUsed}
                                            max={Math.max(formData.minutes_included * 2, 100)}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>0</span>
                                            <span>{Math.max(formData.minutes_included * 2, 100).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Unit Economics */}
                                    <div className="p-2 bg-muted/30 rounded-lg border">
                                        <h5 className="font-medium text-sm mb-1 text-foreground">Per-Minute Economics</h5>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Unit Revenue:</span>
                                                <span className="font-semibold text-sm text-green-600 dark:text-green-400">
                                                    {getCurrencySymbol(formData.currency)}{unitRevenue.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Unit Cost:</span>
                                                <span className="font-semibold text-sm text-red-600 dark:text-red-400">
                                                    {getCurrencySymbol(formData.currency)}{unitCost.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1 border-t border-border">
                                                <span className="text-xs font-medium text-foreground">Unit Profit:</span>
                                                <span className={`font-bold text-sm ${unitProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {getCurrencySymbol(formData.currency)}{unitProfit.toFixed(4)}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Margin Tendency Indicator */}
                                        {pricePerMinuteDollars > 0 && averageCostPerMinute > 0 && (
                                            <div className="mt-2 pt-2 border-t border-border">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-muted-foreground">Margin tends towards:</span>
                                                    <span className={`font-bold text-xs ${unitProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {((unitProfit / unitRevenue) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    As usage increases beyond included minutes
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Financial Summary */}
                                <div className="p-2 bg-muted/30 rounded-lg border">
                                    <h4 className="font-medium text-sm mb-1 text-foreground">Financial Summary</h4>
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center">
                                                <div className={`text-xl font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                                    {getCurrencySymbol(formData.currency)}{Math.abs(profit).toFixed(2)}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {profit >= 0 ? 'Profit' : 'Loss'}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-xl font-bold ${margin >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                                    {Math.abs(margin).toFixed(1)}%
                                                </div>
                                                <div className="text-sm text-muted-foreground">Margin</div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2 border-t border-border space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Revenue:</span>
                                                <span className="text-sm font-medium">{getCurrencySymbol(formData.currency)}{totalRevenue.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Direct Cost:</span>
                                                <span className="text-sm font-medium">{getCurrencySymbol(formData.currency)}{totalDirectCost.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Processing Fees (Approx: 2% + 20 cents):</span>
                                                <span className="text-sm font-medium">{getCurrencySymbol(formData.currency)}{totalProcessingFees.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center font-medium border-t border-border pt-1">
                                                <span className="text-sm text-foreground">Total Cost:</span>
                                                <span className="text-sm">{getCurrencySymbol(formData.currency)}{totalCost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-3 border-t">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsOpen(false)}
                            disabled={isCreating}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating || !formData.name.trim()}>
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Product
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

