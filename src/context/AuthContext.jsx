import { createContext,useContext,useEffect,useState,useCallback } from 'react';
import { authApi } from '../API/auth';
const AuthContext=createContext(null);
const MOCK_USERS_KEY='mvec_users';
const seeded=[
 {id:'u1',fullName:'Aline Uwase',telephone:'+250788100001',email:'buyer@mvec.rw',gender:'female',role:'buyer',password:'Buyer@123',companyName:''},
 {id:'u2',fullName:'Eric Mugabo',telephone:'+250788100002',email:'vendor@mvec.rw',gender:'male',role:'vendor',password:'Vendor@123',companyName:'Kigali Tech Store'},
 {id:'u3',fullName:'MVEC Administrator',telephone:'+250788100003',email:'admin@mvec.rw',gender:'other',role:'super_admin',password:'Admin@123',companyName:'MVEC Platform'},
];
function users(){ const raw=localStorage.getItem(MOCK_USERS_KEY); if(!raw){localStorage.setItem(MOCK_USERS_KEY,JSON.stringify(seeded));return seeded;} return JSON.parse(raw); }
function mockLogin(identity,password){ const u=users().find(x=>(x.email.toLowerCase()===identity.toLowerCase()||x.telephone===identity)&&x.password===password); if(!u) throw new Error('Invalid email/telephone or password. Try one of the demo accounts.'); const {password:_,...safe}=u; return {token:`mock-${u.id}-${Date.now()}`,user:safe}; }
function mockRegister(payload){ const list=users(); if(list.some(x=>x.email.toLowerCase()===payload.email.toLowerCase()||x.telephone===payload.telephone)) throw new Error('An account with that email or telephone already exists.'); const u={id:`u${Date.now()}`,...payload}; list.push(u); localStorage.setItem(MOCK_USERS_KEY,JSON.stringify(list)); const {password:_,...safe}=u; return {token:`mock-${u.id}`,user:safe}; }
export function AuthProvider({children}){
 const [user,setUser]=useState(null); const [loading,setLoading]=useState(true);
 const loadMe=useCallback(async()=>{ const token=localStorage.getItem('huska_token'); if(!token){setUser(null);setLoading(false);return;} const mock=localStorage.getItem('mvec_mock_user'); if(mock){setUser(JSON.parse(mock));setLoading(false);return;} try{const me=await authApi.me();setUser(me);}catch{localStorage.removeItem('huska_token');setUser(null);}finally{setLoading(false);} },[]);
 useEffect(()=>{loadMe()},[loadMe]);
 function persistSession({token,user:u}){localStorage.setItem('huska_token',token);localStorage.setItem('mvec_mock_user',JSON.stringify(u));setUser(u);}
 async function login(identity,password){ const data=import.meta.env.VITE_USE_MOCK_AUTH==='false'?await authApi.login({email:identity,password}):mockLogin(identity,password);persistSession(data);return data.user; }
 async function resetPassword(email,password){ const list=users(); const i=list.findIndex(x=>x.email.toLowerCase()===email.toLowerCase()); if(i<0) throw new Error('No MVEC account was found for that Gmail address.'); list[i].password=password; localStorage.setItem(MOCK_USERS_KEY,JSON.stringify(list)); return true; }
 async function register(payload){ const data=import.meta.env.VITE_USE_MOCK_AUTH==='false'?await authApi.register(payload):mockRegister(payload);persistSession(data);return data.user; }
 function logout(){localStorage.removeItem('huska_token');localStorage.removeItem('mvec_mock_user');setUser(null);}
 async function refresh(){return user;}
 return <AuthContext.Provider value={{user,loading,login,register,resetPassword,logout,refresh,setUser}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const ctx=useContext(AuthContext);if(!ctx)throw new Error('useAuth must be used within AuthProvider');return ctx;}
