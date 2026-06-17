import { supabase } from "@/api/supabase";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import { getAgentSession } from "@/lib/agentAuth";
import {
  clearAgentCache,
  getAgentIdByName,
  getAgentNameById,
  loadAgentCache,
} from "@/lib/crmAgentCache";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCloudUuid(id) {
  return UUID_RE.test(String(id || ""));
}

function newCloudId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `crm_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function mapCustomerRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    company: row.company || "",
    tax_id: row.tax_id || "",
    address: row.address || "",
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapCustomerToRow(customer, { createdByAgentId } = {}) {
  const row = {
    id: isCloudUuid(customer.id) ? customer.id : undefined,
    name: String(customer.name || "").trim(),
    phone: customer.phone || null,
    email: customer.email || null,
    company: customer.company || null,
    tax_id: customer.tax_id || null,
    address: customer.address || null,
    notes: customer.notes || null,
    created_at: customer.created_at,
    updated_at: customer.updated_at,
  };
  if (createdByAgentId) row.created_by_agent_id = createdByAgentId;
  return row;
}

export function mapContactRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    name: row.name || "",
    role_title: row.role_title || "",
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
  };
}

export function mapContactToRow(contact) {
  return {
    id: isCloudUuid(contact.id) ? contact.id : undefined,
    customer_id: contact.customer_id,
    name: String(contact.name || "").trim(),
    role_title: contact.role_title || null,
    phone: contact.phone || null,
    email: contact.email || null,
    notes: contact.notes || null,
    sort_order: contact.sort_order ?? 0,
    created_at: contact.created_at,
  };
}

export function mapProductRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    product_name: row.product_name || "",
    product_code: row.product_code || "",
    status: row.status || "",
    notes: row.notes || "",
    created_at: row.created_at,
  };
}

export function mapProductToRow(product) {
  return {
    id: isCloudUuid(product.id) ? product.id : undefined,
    customer_id: product.customer_id,
    product_name: String(product.product_name || "").trim(),
    product_code: product.product_code || null,
    status: product.status || null,
    notes: product.notes || null,
    created_at: product.created_at,
  };
}

export function mapReferralRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    referral_topic: row.referral_topic,
    description: row.description || "",
    agent_name: getAgentNameById(row.created_by_agent_id) || getAgentNameById(row.original_agent_id),
    original_agent_name: getAgentNameById(row.original_agent_id) || getAgentNameById(row.created_by_agent_id),
    assigned_to_type: row.assigned_to_type || "agent",
    assigned_agent_name: getAgentNameById(row.assigned_agent_id) || null,
    assigned_department_id: row.assigned_department_id || null,
    status: row.status,
    priority: row.priority || "normal",
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    last_activity_at: row.last_activity_at,
    reopened_at: row.reopened_at,
    created_at: row.created_at,
  };
}

export function mapReferralToRow(referral) {
  const createdBy = getAgentIdByName(referral.agent_name || referral.original_agent_name);
  const originalId = getAgentIdByName(referral.original_agent_name || referral.agent_name);
  const assignedAgentId =
    referral.assigned_to_type === "agent"
      ? getAgentIdByName(referral.assigned_agent_name)
      : null;
  return {
    id: isCloudUuid(referral.id) ? referral.id : undefined,
    customer_id: referral.customer_id,
    referral_topic: referral.referral_topic,
    description: referral.description || "",
    status: referral.status || "open",
    priority: referral.priority || "normal",
    assigned_to_type: referral.assigned_to_type || "agent",
    assigned_agent_id: assignedAgentId,
    assigned_department_id:
      referral.assigned_to_type === "department" ? referral.assigned_department_id : null,
    created_by_agent_id: createdBy,
    original_agent_id: originalId,
    opened_at: referral.opened_at,
    closed_at: referral.closed_at,
    last_activity_at: referral.last_activity_at,
    reopened_at: referral.reopened_at,
    created_at: referral.created_at,
  };
}

export function mapCallLogRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    referral_id: row.referral_id,
    occurred_at: row.occurred_at,
    call_type: row.call_type,
    summary: row.summary || "",
    agent_name: getAgentNameById(row.agent_id),
    duration_minutes: row.duration_minutes,
    referral_topic: row.referral_topic,
    created_at: row.created_at,
  };
}

export function mapCallLogToRow(log) {
  return {
    id: isCloudUuid(log.id) ? log.id : undefined,
    customer_id: log.customer_id,
    referral_id: log.referral_id || null,
    occurred_at: log.occurred_at,
    call_type: log.call_type,
    summary: log.summary || "",
    agent_id: getAgentIdByName(log.agent_name),
    duration_minutes: log.duration_minutes,
    referral_topic: log.referral_topic,
    created_at: log.created_at,
  };
}

export function mapEmailLogRowToLocal(row) {
  if (!row) return null;
  const direction = row.direction || "outbound";
  return {
    id: row.id,
    customer_id: row.customer_id,
    referral_id: row.referral_id,
    to_email: direction === "inbound" ? row.from_email || "" : row.to_email || "",
    from_email: row.from_email,
    subject: row.subject || "",
    body: row.body || "",
    referral_topic: row.referral_topic,
    sent_at: row.sent_at,
    agent_name: getAgentNameById(row.agent_id),
    status: row.status,
    direction,
    created_at: row.created_at,
  };
}

export function mapEmailLogToRow(log) {
  const direction = log.direction === "inbound" ? "inbound" : "outbound";
  return {
    id: isCloudUuid(log.id) ? log.id : undefined,
    customer_id: log.customer_id,
    referral_id: log.referral_id || null,
    direction,
    to_email: direction === "outbound" ? log.to_email || null : null,
    from_email: direction === "inbound" ? log.to_email || log.from_email || null : null,
    subject: log.subject || "",
    body: log.body || "",
    referral_topic: log.referral_topic,
    sent_at: log.sent_at,
    agent_id: getAgentIdByName(log.agent_name),
    status: log.status || "simulated",
    created_at: log.created_at,
  };
}

async function fetchTable(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data || [];
}

export async function loadCrmFromCloud() {
  if (!isCrmCloudEnabled() || !supabase) {
    return {
      customers: [],
      referrals: [],
      callLogs: [],
      emailLogs: [],
      customerContacts: [],
      customerProducts: [],
    };
  }
  await loadAgentCache();
  const [customers, referrals, callLogs, emailLogs, customerContacts, customerProducts] =
    await Promise.all([
      fetchTable("crm_customers"),
      fetchTable("crm_referrals"),
      fetchTable("crm_call_logs"),
      fetchTable("crm_email_logs"),
      fetchTable("crm_customer_contacts"),
      fetchTable("crm_customer_products"),
    ]);
  return {
    customers: customers.map(mapCustomerRowToLocal).filter(Boolean),
    referrals: referrals.map(mapReferralRowToLocal).filter(Boolean),
    callLogs: callLogs.map(mapCallLogRowToLocal).filter(Boolean),
    emailLogs: emailLogs.map(mapEmailLogRowToLocal).filter(Boolean),
    customerContacts: customerContacts.map(mapContactRowToLocal).filter(Boolean),
    customerProducts: customerProducts.map(mapProductRowToLocal).filter(Boolean),
  };
}

export async function isCrmCloudEmpty() {
  if (!supabase) return true;
  const { count, error } = await supabase
    .from("crm_customers")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count || 0) === 0;
}

export async function migrateLocalStoreToCloud(localStore) {
  if (!isCrmCloudEnabled() || !supabase) return localStore;
  await loadAgentCache();

  const idMap = new Map();
  const remap = (id) => idMap.get(id) || id;

  for (const customer of localStore.customers || []) {
    const newId = newCloudId();
    idMap.set(customer.id, newId);
    const row = mapCustomerToRow({ ...customer, id: newId });
    const { error } = await supabase.from("crm_customers").insert(row);
    if (error) throw error;
  }

  for (const referral of localStore.referrals || []) {
    const newId = newCloudId();
    idMap.set(referral.id, newId);
    const mapped = {
      ...referral,
      id: newId,
      customer_id: remap(referral.customer_id),
    };
    const row = mapReferralToRow(mapped);
    row.id = newId;
    row.customer_id = mapped.customer_id;
    const { error } = await supabase.from("crm_referrals").insert(row);
    if (error) throw error;
  }

  for (const log of localStore.callLogs || []) {
    const row = mapCallLogToRow({
      ...log,
      id: newCloudId(),
      customer_id: remap(log.customer_id),
    });
    const { error } = await supabase.from("crm_call_logs").insert(row);
    if (error) throw error;
  }

  for (const log of localStore.emailLogs || []) {
    const row = mapEmailLogToRow({
      ...log,
      id: newCloudId(),
      customer_id: remap(log.customer_id),
    });
    const { error } = await supabase.from("crm_email_logs").insert(row);
    if (error) throw error;
  }

  for (const contact of localStore.customerContacts || []) {
    const row = mapContactToRow({
      ...contact,
      id: newCloudId(),
      customer_id: remap(contact.customer_id),
    });
    const { error } = await supabase.from("crm_customer_contacts").insert(row);
    if (error) throw error;
  }

  for (const product of localStore.customerProducts || []) {
    const row = mapProductToRow({
      ...product,
      id: newCloudId(),
      customer_id: remap(product.customer_id),
    });
    const { error } = await supabase.from("crm_customer_products").insert(row);
    if (error) throw error;
  }

  return loadCrmFromCloud();
}

export async function persistCustomer(customer) {
  if (!isCrmCloudEnabled() || !supabase) return customer;
  await loadAgentCache();
  const isUpdate = isCloudUuid(customer.id);
  const row = mapCustomerToRow(customer, {
    createdByAgentId: isUpdate ? null : getAgentSession()?.id || null,
  });
  if (isUpdate) {
    const { error } = await supabase.from("crm_customers").update(row).eq("id", customer.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_customers").insert({ ...row, id });
    if (error) throw error;
    customer = { ...customer, id };
  }
  return customer;
}

export async function deleteCustomerFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_customers").delete().eq("id", id);
  if (error) throw error;
}

export async function persistReferral(referral) {
  if (!isCrmCloudEnabled() || !supabase) return referral;
  await loadAgentCache();
  const row = mapReferralToRow(referral);
  if (isCloudUuid(referral.id)) {
    const { error } = await supabase.from("crm_referrals").update(row).eq("id", referral.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_referrals").insert({ ...row, id });
    if (error) throw error;
    referral = { ...referral, id };
  }
  return referral;
}

export async function deleteReferralFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_referrals").delete().eq("id", id);
  if (error) throw error;
}

export async function persistCallLog(log) {
  if (!isCrmCloudEnabled() || !supabase) return log;
  await loadAgentCache();
  const row = mapCallLogToRow(log);
  if (isCloudUuid(log.id)) {
    const { error } = await supabase.from("crm_call_logs").update(row).eq("id", log.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_call_logs").insert({ ...row, id });
    if (error) throw error;
    log = { ...log, id };
  }
  return log;
}

export async function deleteCallLogFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_call_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function persistEmailLog(log) {
  if (!isCrmCloudEnabled() || !supabase) return log;
  await loadAgentCache();
  const row = mapEmailLogToRow(log);
  if (isCloudUuid(log.id)) {
    const { error } = await supabase.from("crm_email_logs").update(row).eq("id", log.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_email_logs").insert({ ...row, id });
    if (error) throw error;
    log = { ...log, id };
  }
  return log;
}

export async function deleteEmailLogFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_email_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function persistContact(contact) {
  if (!isCrmCloudEnabled() || !supabase) return contact;
  const row = mapContactToRow(contact);
  if (isCloudUuid(contact.id)) {
    const { error } = await supabase.from("crm_customer_contacts").update(row).eq("id", contact.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_customer_contacts").insert({ ...row, id });
    if (error) throw error;
    contact = { ...contact, id };
  }
  return contact;
}

export async function deleteContactFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_customer_contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function persistProduct(product) {
  if (!isCrmCloudEnabled() || !supabase) return product;
  const row = mapProductToRow(product);
  if (isCloudUuid(product.id)) {
    const { error } = await supabase.from("crm_customer_products").update(row).eq("id", product.id);
    if (error) throw error;
  } else {
    const id = newCloudId();
    const { error } = await supabase.from("crm_customer_products").insert({ ...row, id });
    if (error) throw error;
    product = { ...product, id };
  }
  return product;
}

export async function deleteProductFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(id)) return;
  const { error } = await supabase.from("crm_customer_products").delete().eq("id", id);
  if (error) throw error;
}

export async function logReferralEvent(referralId, eventType, oldValue = {}, newValue = {}) {
  if (!isCrmCloudEnabled() || !supabase || !isCloudUuid(referralId)) return;
  await loadAgentCache();
  const actorId = getAgentSession()?.id || null;
  const { error } = await supabase.from("crm_referral_events").insert({
    referral_id: referralId,
    event_type: eventType,
    actor_agent_id: actorId,
    old_value: oldValue,
    new_value: newValue,
  });
  if (error) console.warn("[crmCloudSync] referral event failed", error);
}

export async function loadDepartmentsFromCloud() {
  if (!isCrmCloudEnabled() || !supabase) return null;
  await loadAgentCache();
  const [depts, members] = await Promise.all([
    fetchTable("crm_departments"),
    fetchTable("crm_department_members"),
  ]);
  const membersByDept = new Map();
  for (const m of members) {
    const name = getAgentNameById(m.agent_id);
    if (!name) continue;
    if (!membersByDept.has(m.department_id)) membersByDept.set(m.department_id, []);
    membersByDept.get(m.department_id).push(name);
  }
  return depts
    .filter((d) => d.active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((d) => ({
      id: d.id,
      name: d.name,
      agentNames: membersByDept.get(d.id) || [],
    }));
}

export async function persistDepartmentsToCloud(departments) {
  if (!isCrmCloudEnabled() || !supabase) return;
  await loadAgentCache();

  const existing = await fetchTable("crm_departments");
  const existingIds = new Set(existing.map((d) => d.id));
  const nextIds = new Set(departments.map((d) => d.id));

  for (const dept of departments) {
    const payload = {
      id: dept.id,
      name: dept.name,
      active: true,
      sort_order: departments.indexOf(dept),
    };
    if (existingIds.has(dept.id)) {
      const { error } = await supabase.from("crm_departments").update(payload).eq("id", dept.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("crm_departments").insert(payload);
      if (error) throw error;
    }
  }

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      const { error } = await supabase.from("crm_departments").delete().eq("id", id);
      if (error) throw error;
    }
  }

  const existingMembers = await fetchTable("crm_department_members");
  if (existingMembers.length) {
    const { error: delMembersErr } = await supabase
      .from("crm_department_members")
      .delete()
      .in(
        "id",
        existingMembers.map((m) => m.id)
      );
    if (delMembersErr) throw delMembersErr;
  }

  const memberRows = [];
  for (const dept of departments) {
    for (const agentName of dept.agentNames || []) {
      const agentId = getAgentIdByName(agentName);
      if (!agentId) continue;
      memberRows.push({ department_id: dept.id, agent_id: agentId });
    }
  }
  if (memberRows.length) {
    const { error } = await supabase.from("crm_department_members").insert(memberRows);
    if (error) throw error;
  }
}

export async function deleteDepartmentFromCloud(id) {
  if (!isCrmCloudEnabled() || !supabase) return;
  const { error } = await supabase.from("crm_departments").delete().eq("id", id);
  if (error) throw error;
}

export function invalidateCrmCloudCache() {
  clearAgentCache();
}
