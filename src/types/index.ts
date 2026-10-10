export type UserRole = 'admin' | 'operador';

export type VehicleCategory = 'DRIFT' | 'JEEP' | 'BATE_BATE';

export type VehicleStatus = 'disponivel' | 'em_uso' | 'manutencao';

export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO';

export type PaymentStatus = 'PAGO' | 'NAO_PAGO';

export type RentalMode = 'padrao' | 'agendado' | 'manual';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  phone?: string;
  createdAt: number;
}

export interface Tenant {
  id: string;
  name: string;
  city: string;
  document: string; // CNPJ / CPF
  active: boolean;
  colorTheme?: string;
  pricing: {
    [durationMinutes: number]: number;
  };
}

export interface Vehicle {
  id: string;
  tenantId: string;
  name: string;
  code: string; // e.g. #01, #02
  category: VehicleCategory;
  status: VehicleStatus;
  batteryLevel?: number; // 0 - 100%
  totalRuns: number;
  activeRentalId?: string;
  imageUrl?: string;
}

export interface Rental {
  id: string;
  tenantId: string;
  vehicleId: string;
  vehicleName: string;
  vehicleCode: string;
  vehicleCategory: VehicleCategory;
  customerName: string;
  customerPhone: string;
  durationMinutes: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  mode: RentalMode;
  startTime: number; // timestamp ms
  endTime: number;   // timestamp ms
  status: 'ativa' | 'concluida' | 'cancelada' | 'anulada';
  operatorId: string;
  operatorName: string;
  createdAt: number;
  notes?: string;
  isManualPastEntry?: boolean;
  isNightClosure?: boolean;
  closureDetails?: {
    totalRuns?: number;
    pixAmount?: number;
    cardAmount?: number;
    cashAmount?: number;
    shiftName?: string;
  };
}

export interface QueueItem {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  categoryDesired: VehicleCategory;
  durationMinutes: number;
  status: 'aguardando' | 'chamado' | 'cancelado';
  addedAt: number;
  notes?: string;
}

export interface PriceTier {
  durationMinutes: number;
  price: number;
  popular?: boolean;
}
