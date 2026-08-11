export interface CurrencyAmount {
  currency: string;
  total: number;
  count: number;
}

export interface CurrencyValue {
  currency: string;
  value: number;
}

export interface CountBucket {
  key: string;
  count: number;
}

export interface TrendPoint {
  bucket: string;
  count: number;
}

export interface RevenueTrendPoint {
  bucket: string;
  currency: string;
  total: number;
  count: number;
}

export interface OccupancyResult {
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
}

export interface PropertyReportEntry {
  propertyId: string;
  title: string;
  status: string;
  reservationCount: number;
  revenue: CurrencyAmount[];
  occupancy: OccupancyResult;
}

export interface ReportsSummary {
  period: {
    start: string;
    end: string;
    granularity: "day" | "week" | "month";
  };

  overview: {
    totalReservations: number;
    revenue: CurrencyAmount[];
    avgLengthOfStay: number | null;
    adr: CurrencyValue[];
    cancellationRate: number;
    bookingVolume: number;
    occupancyRate: number;
  };

  revenue: {
    trend: RevenueTrendPoint[];
    byCurrency: CurrencyAmount[];
  };

  bookings: {
    volumeTrend: TrendPoint[];
    bySource: CountBucket[];
    byStatus: CountBucket[];
    cancellationRate: number;
    avgLengthOfStay: number | null;
    avgLeadTimeDays: number | null;
  };

  properties: PropertyReportEntry[];

  guests: {
    newGuestsTrend: TrendPoint[];
    vipProportion: number;
    byCountry: CountBucket[];
    byLanguage: CountBucket[];
    repeatGuestCount: number;
    repeatGuestRate: number;
    uniqueGuestCount: number;
  };

  cleaning: {
    taskVolume: number;
    byStatus: CountBucket[];
    byPriority: CountBucket[];
    avgCompletionHours: number | null;
    byProperty: CountBucket[];
  };

  maintenance: {
    ticketVolume: number;
    byStatus: CountBucket[];
    byPriority: CountBucket[];
    byCategory: CountBucket[];
    avgResolutionHours: number | null;
    estimatedCostTotal: number;
    actualCostTotal: number;
    costVariance: number;
  };

  inventory: {
    totalItems: number;
    lowStockCount: number;
    byCategory: CountBucket[];
  };
}
