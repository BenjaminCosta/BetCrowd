# Cálculo de odds (cuotas) — Resumen del código actual

Este archivo documenta cómo se calculan las odds en la aplicación actualmente, basándome en el código fuente relevante.

**Ubicación principal del código:** [src/services/betService.ts](src/services/betService.ts#L731-L805)

**Funciones clave:**
- `calculateOdds(bet, fee = 0.05)` — calcula las odds actuales por opción.
- `calculateEstimatedOdds(bet, selectedOption, stakeAmount, existingPickOption?, existingPickStake?, fee = 0.05)` — estima la odd que obtendría un usuario si pusiera (o editara) una apuesta.

Resumen del algoritmo (pasos principales):

1. Condiciones iniciales
- Si `bet.totalPot` no existe o es 0, o `bet.optionTotals` es nulo, la función muestra `—` para cada opción (no hay picks activas).

2. Tarifa / comisión
- Se aplica una `fee` (por defecto 0.05 = 5%).
- Se calcula el "effectivePot":

  $$\text{effectivePot} = \text{totalPot} \times (1 - \text{fee})$$

3. Cálculo por opción
- Para cada opción: se obtiene `amountOnOption = bet.optionTotals[option]`.
- Si `amountOnOption <= 0` se muestra `—` (nadie apostó en esa opción).
- Si `amountOnOption > 0`, la odd se calcula como:

  $$\text{odds} = \frac{\text{effectivePot}}{\text{amountOnOption}}$$

- El valor para mostrar se limita a máximo `99.99` y se formatea con dos decimales.

4. Reglas de visualización y límites
- Si hay menos de 2 lados con picks (mercado no activado), `calculateEstimatedOdds` devuelve `—` para evitar mostrar odds reales.
- Las odds se muestran como cadenas con dos decimales o `—` cuando no aplican.

Detalle sobre `calculateEstimatedOdds` (cómo proyecta la apuesta del usuario):

- Reproduce exactamente la lógica de `upsertMyPick` cuando edita/crea una apuesta:
  1. Si el usuario ya tenía una apuesta en otra opción (edit), primero "deshace" esa contribución restando `existingPickStake` del `newPot` y del `newOptionTotals[existingPickOption]`.
  2. Luego aplica la nueva apuesta sumando `stakeAmount` al `newPot` y a `newOptionTotals[selectedOption]`.
  3. Si tras la proyección hay menos de 2 lados con picks, muestra `—`.
  4. Calcula `effectivePot = newPot * (1 - fee)` y la odd = `effectivePot / newOptionTotal` (cap 99.99).

Ejemplo numérico simple

- Supongamos: `totalPot = 1000`, `optionA = 800`, `optionB = 200`, `fee = 0.05`.

  effectivePot = 1000 * 0.95 = 950

  oddA = 950 / 800 = 1.1875 → 1.19

  oddB = 950 / 200 = 4.75 → 4.75

- Si un usuario añade un `stakeAmount = 100` a `optionB`, la proyección usaría `newPot = 1100`, `newOptionTotals.B = 300`:

  effectivePot = 1100 * 0.95 = 1045

  oddB = 1045 / 300 ≈ 3.4833 → 3.48

Observaciones importantes y notas de implementación

- La implementación asume que `bet.optionTotals` está indexado por las cadenas que aparecen en `bet.options`. En algunos lugares del código, cuando la selección es un objeto, se usa `JSON.stringify(selection)` como clave; `calculateOdds` accede directamente por la opción (cadena), por lo que es importante que las claves coincidan con `bet.options`.

> **⚠️ WARNING — Key consistency in `optionTotals`**
>
> The keys stored in `bet.optionTotals` **must exactly match** the entries in `bet.options`.
> When a pick selection is an object, you **must** use `JSON.stringify(selection)` as the key,
> not the raw object reference.
>
> **Before (broken — object key, never matches):**
> ```ts
> // ❌ Wrong: object identity, not a string key
> optionTotals[pick.selection] += stakeAmount;
> ```
>
> **After (correct):**
> ```ts
> // ✅ Correct: serialised key that matches bet.options entries
> const key = typeof pick.selection === 'object'
>   ? JSON.stringify(pick.selection)
>   : String(pick.selection);
> optionTotals[key] = (optionTotals[key] ?? 0) + stakeAmount;
> ```
>
> **Validation checklist before calling `calculateOdds`:**
> 1. Every entry in `bet.options` has a corresponding key in `bet.optionTotals`.
> 2. Object selections are serialised with `JSON.stringify(selection)` when written.
> 3. The same serialisation is used when reading totals in `calculateOdds`.
> 4. Verify consistency with: `bet.options.every(opt => opt in bet.optionTotals)`.
- `fee` por defecto es 0.05 (5%) y se aplica al total del pozo antes de calcular payouts.
- El tope visual de `99.99` evita valores infinitos o extremadamente altos para mostrar.
- El pago mostrado en interfaces (por ejemplo `ResultInfoSheet`) multiplica la odd mostrada por el `stakeAmount` para calcular `payoutAmount` cuando `stakeType === 'fixed'`.

Referencias en el código
- Implementación de `calculateOdds`: [src/services/betService.ts](src/services/betService.ts#L731-L756)
- Implementación de `calculateEstimatedOdds`: [src/services/betService.ts](src/services/betService.ts#L764-L805)
- Uso para mostrar odds en pantalla: [src/screens/main/TournamentPredictionsScreen.tsx](src/screens/main/TournamentPredictionsScreen.tsx#L200-L220)
- Cálculo de payout en UI: [src/components/ResultInfoSheet.tsx](src/components/ResultInfoSheet.tsx#L78-L84)

Si querés, puedo:
- Añadir ejemplos adicionales para escenarios edge-case (pocos picks, edición que deja 0 en una opción). 
- Proponer tests unitarios para `calculateOdds` y `calculateEstimatedOdds`.

Fin del análisis.
