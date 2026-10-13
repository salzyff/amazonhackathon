import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request:NextRequest){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return NextResponse.next();
  let response=NextResponse.next({request});
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
    cookies:{getAll:()=>request.cookies.getAll(),setAll:(cookies,headers)=>{
      for(const {name,value} of cookies)request.cookies.set(name,value);
      response=NextResponse.next({request});
      for(const {name,value,options} of cookies)response.cookies.set(name,value,options);
      for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
    }},
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
export const config={matcher:["/","/login","/join","/api/:path*"]};
