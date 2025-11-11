"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface CartItem {
  productId: number;
  tierId?: number;
  quantity: number;
  product?: {
    id: number;
    title: string;
    price: number;
    cover_image?: string;
    product_type: string;
    is_ticket_event?: boolean;
  };
  tier?: {
    id: number;
    name: string;
    price: number;
  };
}

interface CartContextType {
  items: CartItem[];
  addItem: (productId: number, tierId?: number, quantity?: number, product?: CartItem["product"], tier?: CartItem["tier"]) => void;
  removeItem: (productId: number, tierId?: number) => void;
  updateQuantity: (productId: number, tierId: number | undefined, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = (
    productId: number,
    tierId?: number,
    quantity: number = 1,
    product?: CartItem["product"],
    tier?: CartItem["tier"]
  ) => {
    setItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === productId && item.tierId === tierId
      );

      if (existing) {
        return prev.map((item) =>
          item.productId === productId && item.tierId === tierId
            ? { ...item, quantity: item.quantity + quantity, product, tier }
            : item
        );
      }

      return [...prev, { productId, tierId, quantity, product, tier }];
    });
  };

  const removeItem = (productId: number, tierId?: number) => {
    setItems((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && item.tierId === tierId)
      )
    );
  };

  const updateQuantity = (
    productId: number,
    tierId: number | undefined,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(productId, tierId);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId && item.tierId === tierId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotal = () => {
    return items.reduce((total, item) => {
      const price = item.tier?.price || item.product?.price || 0;
      return total + price * item.quantity;
    }, 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}


