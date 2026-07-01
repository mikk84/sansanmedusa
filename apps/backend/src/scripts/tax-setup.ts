/**
 * tax-setup.ts — configure Estonian VAT (remediation C2).
 *
 * Run once: pnpm exec medusa exec ./src/scripts/tax-setup.ts
 *
 * - Creates an Estonia tax region with a 24% standard rate (EE standard VAT
 *   since 2025-07-01). Change VAT_RATE if the law/rate changes.
 * - Marks the EUR currency + Eesti region price preferences **tax-inclusive**:
 *   catalog prices were migrated from Magento as gross (retail, incl. VAT), so
 *   Medusa must extract the VAT from the gross rather than add it on top.
 *
 * Idempotent: skips the tax region if one already exists for EE.
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTaxRegionsWorkflow } from "@medusajs/core-flows"

const VAT_RATE = 24 // Estonia standard VAT (from 2025-07-01)
const COUNTRY = "ee"

export default async function taxSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = container.resolve(Modules.PRICING)

  // ── Tax region (skip if present) ──────────────────────────────────────────
  const { data: existing } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })
  if (existing.some((t: any) => t.country_code === COUNTRY)) {
    logger.info("tax-setup — EE tax region already exists, skipping create")
  } else {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: COUNTRY,
          provider_id: "tp_system", // built-in system tax provider
          default_tax_rate: {
            name: `Käibemaks ${VAT_RATE}%`,
            code: "VAT-EE",
            rate: VAT_RATE,
          },
        },
      ],
    })
    logger.info(`tax-setup — created EE tax region @ ${VAT_RATE}%`)
  }

  // ── Tax-inclusive pricing (prices are gross) ──────────────────────────────
  const prefs = await pricing.listPricePreferences({}, { take: 100 })
  const toMakeInclusive = prefs.filter((p: any) => !p.is_tax_inclusive)
  for (const p of toMakeInclusive) {
    await pricing.updatePricePreferences(p.id, { is_tax_inclusive: true })
  }
  logger.info(
    toMakeInclusive.length
      ? `tax-setup — set ${toMakeInclusive.length} price preferences tax-inclusive`
      : "tax-setup — price preferences already tax-inclusive"
  )

  logger.info("tax-setup — DONE")
}
