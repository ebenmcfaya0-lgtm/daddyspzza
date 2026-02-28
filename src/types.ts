export type UserRole = 'grounds_manager' | 'inventory_keeper' | 'administrator';

export interface Waitress {
  id: string;
  name: string;
  active: boolean;
}

export interface InventoryItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  type: 'Drink' | 'Cocktail' | 'Ice Cream' | 'Teas' | 'Cakes' | 'Others';
}

export interface Sale {
  id: string | number;
  item_type: 'Drink' | 'Cocktail' | 'Ice Cream' | 'Teas' | 'Cakes' | 'Others';
  item_name?: string;
  quantity?: number;
  price: number;
  waiter: string;
  is_paid: boolean;
  tag?: 'Customer' | 'Staff' | 'Boss';
  timestamp: Date | string;
}

export interface Stats {
  total: number;
  unpaid: number;
  byItem: {
    item_type: string;
    total: number;
    count: number;
  }[];
  recent: Sale[];
}
