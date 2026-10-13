import { z } from "zod";
import { adminClient, configured, verifiedUser } from "@/lib/supabase/server";
import { createHousehold } from "@/lib/household";
import { getHousehold } from "@/lib/storage";
const schema=z.object({name:z.string().trim().min(1).max(70),householdName:z.string().trim().min(1).max(100),availableFrom:z.number().int().min(0).max(1438),availableUntil:z.number().int().min(1).max(1439)});
export async function POST(request:Request){
  const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
  if(!configured())return json({error:"Connect Supabase first."},503);
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
  const user=await verifiedUser();if(!user)return json({error:"Sign in first."},401);
  let data;try{data=schema.parse(await request.json());}catch{return json({error:"Enter your name, household name, and availability."},400);}
  if(data.availableFrom>=data.availableUntil)return json({error:"The end time must be after the start time."},400);
  try{if(await getHousehold(user.id))return json({error:"You already belong to a household."},409);
    const state=createHousehold(user.id,data.name,data.householdName);Object.assign(state.members[0],{email:user.email,availableFrom:data.availableFrom,availableUntil:data.availableUntil});
    const {error}=await adminClient().rpc("planb_create_household",{p_user_id:user.id,p_state:state});
    if(error)return json({error:"Couldn’t create your household. Check the database setup or try again."},400);
    return json({ok:true});
  }catch{return json({error:"Household storage isn’t ready yet."},503);}
}
