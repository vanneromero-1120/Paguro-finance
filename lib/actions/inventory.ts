// ============================================================================
// Paguro Finance - Inventory Movement Server Actions
// Authoritative movement ledger, negative stock policy, audit logging
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  InventoryMovement,
  InventoryMovementType,
  RecordMovementInput,
  InventoryMovementWithDetails,
  Product,
} from '@/types/database';
import {
  getMovementDirection,
  validateInventoryMovement,
} from '@/lib/finance/inventory';
import { roundHalfUp } from '@/lib/finance/calculations';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];

/**
 * Retrieves chronological inventory movements ledger for the active company.
 */
export async function getInventoryMovementsAction(
  productId?: string,
  movementType?: string,
  limit: number = 100
): Promise<ActionResponse<InventoryMovementWithDetails[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('inventory_movements')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (productId && productId !== 'all') {
      query = query.eq('product_id', productId);
    }

    if (movementType && movementType !== 'all') {
      query = query.eq('movement_type', movementType);
    }

    query = query.order('movement_date', { ascending: false }).limit(limit);

    const { data: movements, error: movError } = await query;
    if (movError) {
      console.error('[getInventoryMovementsAction] Query error:', movError);
      return { success: false, error: movError.message, data: [] };
    }

    if (!movements || movements.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch products for reference enrichment
    const productIds = Array.from(new Set(movements.map((m: any) => m.product_id)));
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, category, cost')
      .in('id', productIds);

    const productMap = new Map<string, any>();
    (products || []).forEach((p: any) => productMap.set(p.id, p));

    // Fetch user profiles for user reference
    const userIds = Array.from(new Set(movements.map((m: any) => m.created_by).filter(Boolean)));
    const profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      (profiles || []).forEach((pr: any) => profileMap.set(pr.id, pr));
    }

    const enriched: InventoryMovementWithDetails[] = movements.map((m: any) => ({
      ...m,
      quantity_delta: Number(m.quantity_delta),
      unit_cost: Number(m.unit_cost),
      product: productMap.get(m.product_id) || null,
      created_by_profile: m.created_by ? profileMap.get(m.created_by) || null : null,
    }));

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getInventoryMovementsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener movimientos.', data: [] };
  }
}

/**
 * Authoritatively records a new inventory movement with negative stock enforcement,
 * multi-company validation, and audit trail logging.
 */
export async function recordInventoryMovementAction(
  input: RecordMovementInput
): Promise<ActionResponse<InventoryMovement>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador u Operaciones.',
    };
  }

  if (!input.product_id) {
    return { success: false, error: 'Debe especificar el producto para el movimiento.' };
  }

  const rawQty = Number(input.quantity);
  if (isNaN(rawQty) || rawQty <= 0) {
    return { success: false, error: 'La cantidad debe ser un valor numérico positivo mayor a cero.' };
  }

  if (!input.movement_type) {
    return { success: false, error: 'Debe seleccionar un tipo de movimiento válido.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Verify product belongs to active company and is inventory-tracked
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', input.product_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (prodErr || !product) {
      return { success: false, error: 'El producto seleccionado no existe o pertenece a otra empresa.' };
    }

    if (!product.is_inventory_item || product.product_type === 'service') {
      return {
        success: false,
        error: `El producto "${product.name}" está categorizado como servicio o no gestiona inventario físico.`,
      };
    }

    // 2. Determine movement direction (+ / -)
    const direction = getMovementDirection(input.movement_type);
    const quantityDelta = roundHalfUp(direction * Math.abs(rawQty), 4);

    // 3. Negative Stock Policy Check
    // Calculate current stock from authoritative movements in active company
    const { data: existingMovements } = await supabase
      .from('inventory_movements')
      .select('quantity_delta')
      .eq('product_id', product.id)
      .eq('company_id', session.activeCompanyId);

    const currentStock = roundHalfUp(
      (existingMovements || []).reduce((sum, m) => sum + Number(m.quantity_delta || 0), 0),
      4
    );

    const validation = validateInventoryMovement(currentStock, quantityDelta, false);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 4. Resolve unit cost
    const unitCost = input.unit_cost !== undefined && Number(input.unit_cost) >= 0
      ? Number(input.unit_cost)
      : Number(product.cost || 0);

    const payload = {
      company_id: session.activeCompanyId,
      product_id: product.id,
      movement_type: input.movement_type,
      movement_date: input.movement_date || new Date().toISOString(),
      quantity_delta: quantityDelta,
      unit_cost: unitCost,
      source_type: input.source_type || 'MANUAL_ADJUSTMENT',
      source_id: input.source_id || null,
      reason: input.reason?.trim() || null,
      created_by: session.id,
    };

    const { data: movement, error: insertError } = await supabase
      .from('inventory_movements')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      console.error('[recordInventoryMovementAction] Insert error:', insertError);
      return { success: false, error: insertError.message };
    }

    // 5. Append to immutable audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'inventory_movement',
      entity_id: movement.id,
      after_json: {
        ...movement,
        product_sku: product.sku,
        product_name: product.name,
        previous_stock: currentStock,
        new_stock: validation.projectedStock,
      },
    });

    return {
      success: true,
      data: movement as InventoryMovement,
      message: `Movimiento registrado exitosamente. Stock resultante: ${validation.projectedStock} unidades.`,
    };
  } catch (err: any) {
    console.error('[recordInventoryMovementAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al registrar el movimiento.' };
  }
}

/**
 * Calculates current stock directly for a given product ID.
 */
export async function getProductCurrentStockAction(
  productId: string
): Promise<ActionResponse<number>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: 0 };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: 0 };
  }

  try {
    const { data: movements, error } = await supabase
      .from('inventory_movements')
      .select('quantity_delta')
      .eq('product_id', productId)
      .eq('company_id', session.activeCompanyId);

    if (error) {
      return { success: false, error: error.message, data: 0 };
    }

    const stock = (movements || []).reduce((acc, m) => acc + Number(m.quantity_delta || 0), 0);
    return { success: true, data: roundHalfUp(stock, 4) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al calcular stock.', data: 0 };
  }
}
