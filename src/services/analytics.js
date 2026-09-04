import {getOrders} from './mvecStore';

const PERIOD_FACTORS={'Today':0.04,'7 Days':0.24,'30 Days':1,'3 Months':2.9,'6 Months':5.7,'1 Year':11.5};
export function getPeriodFactor(period='30 Days'){return PERIOD_FACTORS[period]||1;}
export function getPeriodMetrics(period='30 Days') {
  const orders=getOrders().filter(o=>o.payment==='SUCCESS'&&o.status!=='Cancelled');
  const liveRevenue=orders.reduce((s,o)=>s+Number(o.total||0),0);
  const baseRevenue=Math.max(18450000,liveRevenue);
  const factor=getPeriodFactor(period);
  const sales=Math.round(baseRevenue*factor);
  const baseOrders=Math.max(327,orders.length||327);
  const orderCount=Math.max(1,Math.round(baseOrders*factor));
  const avgOrder=Math.round(sales/orderCount);
  const customers=Math.max(1,Math.round(1842*Math.min(1,Math.max(.12,factor))));
  const activeVendors=Math.max(1,Math.round(86*Math.min(1,Math.max(.12,Math.sqrt(factor)))));
  return {sales,orders:orderCount,avgOrder,customers,activeVendors};
}

const presets={
  Today:[28,36,42,51,47,61,58,69],
  '7 Days':[34,42,38,55,49,67,62],
  '30 Days':[32,41,37,55,49,62,58,74,67,80,76,92,84,96],
  '3 Months':[36,44,52,48,61,57,69,74,66,82,78,91],
  '6 Months':[31,39,47,43,55,62,58,70,76,69,84,92],
  '1 Year':[26,34,31,45,41,54,50,62,58,70,67,81],
};
export function getPeriodChart(period='30 Days'){
  const seed=presets[period]||presets['30 Days'];
  const orders=getOrders().filter(o=>o.payment==='SUCCESS'&&o.status!=='Cancelled');
  const revenue=orders.reduce((s,o)=>s+Number(o.total||0),0);
  const boost=revenue?Math.min(1.25,Math.max(.72,1+revenue/10000000)):1;
  return seed.map((v,i)=>Math.max(8,Math.min(100,Math.round(v*boost*(1+(i%3)*.025)))));
}
export function getPeriodLabels(period='30 Days'){
  const count=(presets[period]||presets['30 Days']).length;
  return Array.from({length:count},(_,i)=>period==='Today'?`${String(i+1).padStart(2,'0')}:00`:String(i+1));
}
