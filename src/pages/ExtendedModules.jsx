import DashboardLayout from '../components/DashboardLayout';
import Storefront from '../components/Storefront';
import Messages from './Messages';

export function CommunicationPage({role}){
  return role==='buyer'
    ? <Storefront><main className="account-page"><Messages/></main></Storefront>
    : <DashboardLayout admin={role==='admin'}><Messages/></DashboardLayout>;
}
