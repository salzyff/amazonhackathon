import { createHash } from "node:crypto";
import { adminClient, configured, verifiedUser } from "@/lib/supabase/server";
export async function POST(request:Request){
  const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{"Cache-Control":"private, no-store"}});
  if(!configured())return json({error:"Connect Supabase first."},503);
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
  const user=await verifiedUser();if(!user)return json({error:"Sign in with the email address that received the invitation."},401);
  let token;try{const data=await request.json() as {token?:unknown};token=typeof data.token==="string"&&/^[a-f0-9]{64}$/.test(data.token)?data.token:null;}catch{return json({error:"Invalid invitation."},400);}
  if(!token)return json({error:"Invalid invitation."},400);
  const {error}=await adminClient().rpc("planb_accept_invite",{p_token_hash:createHash("sha256").update(token).digest("hex"),p_user_id:user.id,p_email:user.email!.toLowerCase()});
  if(error)return json({error:"This invitation has expired, has already been used, or belongs to another email address. You may also already belong to a household."},400);
  return json({ok:true});
}
