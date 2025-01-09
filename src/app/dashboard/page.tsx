'use client'

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Activity, Truck, Users, AlertCircle } from 'lucide-react';


interface DashboardStats {
  ordersInProduction: number;
  ordersInDelivery: number;
  ordersLate: number;
  totalClients: number;
  clientsInProduction: number;
  clientsInDelivery: number;
  clientsWithLateOrders: number;
  averageProductsPerClient: number;
}

interface OrderTrend {
  month: string;
  orders: number;
}

interface TopClient {
  name: string;
  orders: number;
}

interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface OrderStatus {
  stato: string;
  order_id: string;  
  body: {
    note?: string;
    consegne?: Array<{
      data: string;
      note: string;
    }>;
    quantity: number;
    completedAt?: {
      user: string;
      timestamp: string;
    };
    deliveryDate?: string;
    productionConfirmed?: {
      user: string;
      timestamp: string;
    };
  };
  ordini: {
    client: string;  
    clienti: {
      ragione_sociale: string;
    };
  };
}

const initialStats: DashboardStats = {
  ordersInProduction: 0,
  ordersInDelivery: 0,
  ordersLate: 0,
  totalClients: 0,
  clientsInProduction: 0,
  clientsInDelivery: 0,
  clientsWithLateOrders: 0,
  averageProductsPerClient: 0,
};

const ProductionDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [orderTrends, setOrderTrends] = useState<OrderTrend[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [orderStatusDistribution, setOrderStatusDistribution] = useState<StatusDistribution[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from('link_ordini_client_products').select('stato, order_id, body, ordini:order_id(client, clienti:client(ragione_sociale))');
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }
      
      const { data: ordersStatus } = await query;
      //console.log('Struttura dati ordersStatus:', JSON.stringify(ordersStatus?.[0], null, 2));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersStatusData = ((ordersStatus || []) as unknown) as OrderStatus[];
      const today = new Date();

      // Calcola ordini in ritardo
      const lateOrders = ordersStatusData.filter(order => {
        if (!order.body?.deliveryDate) return false;
        const deliveryDate = new Date(order.body.deliveryDate);
        return deliveryDate < today && order.stato !== 'completato';
      });

      const lateOrdersClients = new Set(
        lateOrders.map(o => o.ordini?.client).filter(Boolean)
      );

      const ordersInProduction = ordersStatusData.filter(o => o.stato === 'produzione').length;
      const ordersInDelivery = ordersStatusData.filter(o => o.stato === 'consegna').length;

      // Clienti unici per stato
      const clientsInProduction = new Set(
        ordersStatusData
          .filter(o => o.stato === 'produzione')
          .map(o => o.ordini?.client)
          .filter(Boolean)
      ).size;

      const clientsInDelivery = new Set(
        ordersStatusData
          .filter(o => o.stato === 'consegna')
          .map(o => o.ordini?.client)
          .filter(Boolean)
      ).size;

      // Fetch total clients
      const { count: totalClients } = await supabase
        .from('clienti')
        .select('*', { count: 'exact', head: true });

      // Calculate average products per client
      const { data: clientProducts } = await supabase
        .from('client_products')
        .select('client');
      
      const avgProducts = totalClients && clientProducts 
        ? Number((clientProducts.length / totalClients).toFixed(1))
        : 0;

      // Order trends
      let trendsQuery = supabase.from('ordini').select('created_at, id');
      if (startDate) trendsQuery = trendsQuery.gte('created_at', startDate.toISOString());
      if (endDate) trendsQuery = trendsQuery.lte('created_at', endDate.toISOString());
      trendsQuery = trendsQuery.order('created_at');

      const { data: orderTrendsData } = await trendsQuery;

      const monthlyTrends = (orderTrendsData || []).reduce<Record<string, number>>((acc, order) => {
        const month = new Date(order.created_at).toLocaleString('it-IT', { month: 'short' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

      const trendArray: OrderTrend[] = Object.entries(monthlyTrends).map(([month, count]) => ({
        month,
        orders: count
      }));

      // Top clients list with order counts
      const clientOrderCounts = ordersStatusData.reduce((acc: Record<string, { name: string, count: number }>, order) => {
        const clientId = order.ordini?.client;
        const clientName = order.ordini?.clienti?.ragione_sociale;
        if (clientId && clientName) {
          if (!acc[clientId]) {
            acc[clientId] = { name: clientName, count: 0 };
          }
          acc[clientId].count++;
        }
        return acc;
      }, {});

      const topClientsList = Object.values(clientOrderCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(client => ({
          name: client.name,
          orders: client.count
        }));

      // Status distribution with percentages
      const statusCounts = ordersStatusData.reduce<Record<string, number>>((acc, { stato }) => {
        if (stato) {
          acc[stato] = (acc[stato] || 0) + 1;
        }
        return acc;
      }, {});

      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      const distributionArray: StatusDistribution[] = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: (count / total) * 100
      }));

      setStats({
        ordersInProduction,
        ordersInDelivery,
        ordersLate: lateOrders.length,
        totalClients: totalClients || 0,
        clientsInProduction,
        clientsInDelivery,
        clientsWithLateOrders: lateOrdersClients.size,
        averageProductsPerClient: avgProducts
      });
      setOrderTrends(trendArray);
      setTopClients(topClientsList);
      setOrderStatusDistribution(distributionArray);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini in Produzione</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ordersInProduction}</div>
            <p className="text-xs text-muted-foreground">
              {stats.clientsInProduction} clienti coinvolti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini in Consegna</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ordersInDelivery}</div>
            <p className="text-xs text-muted-foreground">
              {stats.clientsInDelivery} clienti in attesa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini in Ritardo</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.ordersLate}</div>
            <p className="text-xs text-muted-foreground">
              {stats.clientsWithLateOrders} clienti coinvolti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clienti Totali</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Media di {stats.averageProductsPerClient} prodotti/cliente
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 mb-4">
      <input
        type="date"
        onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
        className="border rounded p-2"
      />
      <input
        type="date"
        onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
        className="border rounded p-2"
      />
    </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Trend Ordini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={orderTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="orders" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Stati Ordini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ status, percentage }) => 
                      `${status} (${percentage.toFixed(1)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {orderStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Clienti per Numero di Ordini</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topClients.map((client, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium">{index + 1}. {client.name}</span>
                <span className="text-gray-600">{client.orders} ordini</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionDashboard;