import { parseIntent, type Action, type Household } from "./household.ts";
export function authorizeAction(state:Household,action:Action,isOwner:boolean,userId:string){
  const member=state.members.find(m=>m.userId===userId);
  if(!member)throw new Error("You are not a member of this household.");
  if(action.type==="reply"){
    const plan=state.plans.find(p=>p.id===action.planId);
    const assignment=plan?.assignments.find(a=>a.id===action.assignmentId);
    const recipient=state.members.find(m=>m.id===assignment?.memberId);
    if(!recipient||recipient.userId!==userId)throw new Error("Only the person receiving a request can reply to it.");
    return;
  }
  if(isOwner)return;
  if(action.type==="member"&&action.memberId===member.id){
    if(action.pickupAllowed!==member.pickupAllowed||action.canReceive!==member.canReceive)throw new Error("Only the household owner can change permissions.");
    return;
  }
  if(action.type==="chat"&&parseIntent(action.text).kind==="status")return;
  throw new Error("The household owner manages plans, tasks, notes, and member permissions.");
}
