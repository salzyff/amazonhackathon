import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, candidate, parseIntent } from '../lib/household.ts';
import {seedHousehold} from './fixtures.ts';
const late = {type:'chat',text:'My meeting is running late. I won’t be home until 6 pm.'};
const planned=()=>applyAction(seedHousehold('2026-10-13'),late);
test('approval gates requests, acceptance gates calendar changes, and declines replan',()=>{
  let s=planned(); const p=s.plans[0];
  assert.equal(p.assignments.length,2);
  assert.equal(p.assignments.find(a=>a.eventId==='school').memberId,'tola');
  assert.equal(p.assignments.find(a=>a.eventId==='groceries').memberId,'maya');
  assert.equal(s.events.find(e=>e.id==='school').ownerId,'sam');
  s=applyAction(s,{type:'approve',planId:p.id});
  assert.ok(s.plans[0].assignments.every(a=>a.status==='waiting'));
  assert.equal(s.events.find(e=>e.id==='school').ownerId,'sam');
  const school=s.plans[0].assignments.find(a=>a.eventId==='school');
  s=applyAction(s,{type:'reply',planId:p.id,assignmentId:school.id,accept:false});
  const fallback=s.plans[0].assignments.at(-1);
  assert.equal(fallback.memberId,'dele'); assert.equal(fallback.status,'proposed');
  assert.equal(s.events.find(e=>e.id==='school').ownerId,'sam');
  assert.throws(()=>applyAction(s,{type:'reply',planId:p.id,assignmentId:fallback.id,accept:true}));
  s=applyAction(s,{type:'approve',planId:p.id});
  for(const a of s.plans[0].assignments.filter(a=>a.status==='waiting'))s=applyAction(s,{type:'reply',planId:p.id,assignmentId:a.id,accept:true});
  assert.equal(s.plans[0].status,'complete');
  assert.equal(s.events.find(e=>e.id==='school').ownerId,'dele');
  assert.equal(s.events.find(e=>e.id==='groceries').ownerId,'maya');
  s=applyAction(s,{type:'chat',text:'Is everything sorted?'});
  assert.match(s.messages.at(-1).text,/Everything.*confirmed/);
});
test('pickup permissions, travel buffers, and real calendar conflicts are enforced',()=>{
  let s=seedHousehold();const school=s.events.find(e=>e.id==='school');
  s.members.find(m=>m.id==='tola').pickupAllowed=false;
  s.members.find(m=>m.id==='dele').availableUntil=school.end;
  assert.equal(candidate(s,school),undefined);
  s.members.find(m=>m.id==='tola').pickupAllowed=true;
  s.events.push({...school,id:'busy',kind:'meeting',title:'Tola busy',ownerId:'tola',start:school.start-10,end:school.start});
  assert.equal(candidate(s,school),undefined);
});
test('overlapping suggested tasks do not double book a member',()=>{
  let s=seedHousehold();s.members.find(m=>m.id==='dele').pickupAllowed=false;
  s.events.push({...s.events.find(e=>e.id==='school'),id:'second-school',title:'Second pickup'});
  s=applyAction(s,late);
  assert.equal(s.plans[0].assignments.find(a=>a.eventId==='second-school').status,'blocked');
});
test('approval and acceptance recheck changes made after proposal',()=>{
  let s=planned();s.members.find(m=>m.id==='tola').pickupAllowed=false;
  s=applyAction(s,{type:'approve',planId:s.plans[0].id});
  assert.equal(s.plans[0].assignments.find(a=>a.eventId==='school').status,'blocked');
  const delivery=s.plans[0].assignments.find(a=>a.eventId==='groceries');
  s.members.find(m=>m.id==='maya').atHome=false;
  assert.throws(()=>applyAction(s,{type:'reply',planId:s.plans[0].id,assignmentId:delivery.id,accept:true}),/availability or permission changed/);
});
test('duplicate approvals and replayed replies cannot repeat changes',()=>{
  let s=planned();const id=s.plans[0].id;s=applyAction(s,{type:'approve',planId:id});
  assert.throws(()=>applyAction(s,{type:'approve',planId:id}));
  const a=s.plans[0].assignments[0];s=applyAction(s,{type:'reply',planId:id,assignmentId:a.id,accept:true});
  assert.throws(()=>applyAction(s,{type:'reply',planId:id,assignmentId:a.id,accept:true}));
});
test('cancel preserves accepted changes and closes unconfirmed requests',()=>{
  let s=planned();const id=s.plans[0].id;s=applyAction(s,{type:'approve',planId:id});
  const a=s.plans[0].assignments[0];s=applyAction(s,{type:'reply',planId:id,assignmentId:a.id,accept:true});
  s=applyAction(s,{type:'cancel',planId:id});assert.equal(s.events.find(e=>e.id==='school').ownerId,'tola');
  assert.equal(s.events.find(e=>e.id==='groceries').status,'scheduled');
  assert.throws(()=>applyAction(s,{type:'reply',planId:id,assignmentId:s.plans[0].assignments[1].id,accept:true}));
});
test('unsupported requests are honest, explicit times work, and notes persist without changing permissions',()=>{
  assert.equal(parseIntent('unavailable until 7:30 pm').until,1170);
  assert.equal(parseIntent('buy something random').kind,'unknown');
  const original=seedHousehold();const updated=applyAction(original,{type:'chat',text:'Remember Maya can collect Noah'});
  assert.equal(updated.memories[0].text,'Maya can collect Noah');
  assert.equal(updated.members.find(m=>m.id==='maya').pickupAllowed,false);
  assert.deepEqual(JSON.parse(JSON.stringify(updated)),updated);
  assert.equal(original.memories.length,3);
});
test('no available person stays blocked instead of inventing coverage',()=>{
  let s=seedHousehold();for(const m of s.members){if(m.id!=='sam'){m.availableFrom=1200;m.availableUntil=1300;}}
  s=applyAction(s,late);assert.equal(s.plans[0].status,'blocked');
  assert.ok(s.plans[0].assignments.every(a=>a.memberId===null));
  s=applyAction(s,{type:'chat',text:'Is everything sorted?'});assert.doesNotMatch(s.messages.at(-1).text,/Everything.*confirmed/);
});
