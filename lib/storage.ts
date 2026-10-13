import { adminClient } from "./supabase/server";
import { today, type Household } from "./household";
export type RecordState={id:string;owner_id:string;state:Household;version:number};
export async function getHousehold(userId:string):Promise<RecordState|null>{
  const db=adminClient();
  const {data:membership,error}=await db.from("planb_memberships").select("household_id").eq("user_id",userId).maybeSingle();
  if(error)throw new Error("Household storage isn’t ready. Apply the Plan B database schema first.");
  if(!membership)return null;
  const {data:row,error:readError}=await db.from("planb_households").select("id, owner_id, state, version").eq("id",membership.household_id).single();
  if(readError||!row)throw new Error("Couldn’t load the household.");
  return row as RecordState;
}
export function forViewer(row:RecordState,userId:string){
  const state=structuredClone(row.state);const member=state.members.find(m=>m.userId===userId);
  if(!member)throw new Error("Household membership is inconsistent. Contact the household owner.");
  state.selfId=member.id;state.date=today();return state;
}
export async function saveHousehold(row:RecordState,state:Household){
  const stored=structuredClone(state);stored.selfId=row.state.selfId;
  const {data,error}=await adminClient().from("planb_households").update({state:stored,version:row.version+1,updated_at:new Date().toISOString()}).eq("id",row.id).eq("version",row.version).select("id").maybeSingle();
  if(error)throw new Error("Couldn’t save your change.");return Boolean(data);
}
