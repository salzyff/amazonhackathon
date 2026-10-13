import { createHash, randomBytes } from "node:crypto";
import { adminClient, configured, verifiedUser } from "@/lib/supabase/server";
import { getHousehold } from "@/lib/storage";
export async function POST(request:Request){
  const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{"Cache-Control":"private, no-store"}});
  if(!configured())return json({error:"Connect Supabase first."},503);
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
  const user=await verifiedUser();if(!user)return json({error:"Sign in first."},401);
  let memberId;try{const data=await request.json() as {memberId?:unknown};memberId=typeof data.memberId==="string"?data.memberId:null;}catch{return json({error:"Choose a household member."},400);}
  try{const row=await getHousehold(user.id);if(!row||row.owner_id!==user.id)return json({error:"Only the household owner can create invitations."},403);
    const member=row.state.members.find(m=>m.id===memberId);if(!member||member.userId||!member.email)return json({error:"Choose a member who has not joined yet."},400);
    const token=randomBytes(32).toString("hex");const tokenHash=createHash("sha256").update(token).digest("hex");
    const db=adminClient();const {error:revokeError}=await db.from("planb_invites").delete().eq("household_id",row.id).eq("member_id",member.id);if(revokeError)throw revokeError;
    const {error}=await db.from("planb_invites").insert({token_hash:tokenHash,household_id:row.id,member_id:member.id,email:member.email.toLowerCase(),expires_at:new Date(Date.now()+7*86400000).toISOString()});if(error)throw error;
    return json({url:`${new URL(request.url).origin}/join?token=${token}`,email:member.email});
  }catch{return json({error:"Couldn’t create the invitation. Please try again."},400);}
}
