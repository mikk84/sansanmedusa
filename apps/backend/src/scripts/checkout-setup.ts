/**
 * checkout-setup.ts — one-time setup so the cart can be checked out.
 *
 * Run with:  pnpm exec medusa exec ./src/scripts/checkout-setup.ts
 *
 * Creates (idempotently):
 *   - a stock location, linked to the sales channel + manual fulfillment provider
 *   - a fulfillment set with an Estonia service zone, linked to the location
 *   - a flat-rate "Kuller" shipping option (4.90 €) on the Default Shipping Profile
 *   - links the system payment provider (pp_system_default) to the Eesti region
 *
 * The manual fulfillment + system payment providers are the demo defaults; the
 * real Montonio provider is swapped in later (needs live credentials).
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStockLocationsWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/core-flows"

const FULFILLMENT_PROVIDER = "manual_manual"
const PAYMENT_PROVIDER = "pp_system_default"

export default async function checkoutSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const salesChannel = container.resolve(Modules.SALES_CHANNEL)

  // ── Region + sales channel + shipping profile ─────────────────────────────
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
  })
  const region = regions.find((r: any) => r.currency_code === "eur")
  if (!region) throw new Error("No EUR region — create one first")

  const [channel] = await salesChannel.listSalesChannels({}, { take: 1 })
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
    pagination: { take: 1 },
  })
  const shippingProfile = profiles[0]

  // ── Stock location (skip if one already exists) ───────────────────────────
  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  let stockLocationId = existingLocations[0]?.id
  if (!stockLocationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "SanSan ladu",
            address: { city: "Tallinn", country_code: "EE", address_1: "Laoaadress 1" },
          },
        ],
      },
    })
    stockLocationId = result[0].id
    logger.info(`checkout-setup — created stock location ${stockLocationId}`)
  }

  // ── Links: location → sales channel + fulfillment provider ────────────────
  await link.create({
    [Modules.SALES_CHANNEL]: { sales_channel_id: channel.id },
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
  }).catch(() => {})
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: FULFILLMENT_PROVIDER },
  }).catch(() => {})

  // ── Fulfillment set + Estonia service zone (skip if present) ──────────────
  const { data: locWithSets } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id", "fulfillment_sets.service_zones.id"],
    filters: { id: stockLocationId },
  })
  let serviceZoneId =
    locWithSets[0]?.fulfillment_sets?.[0]?.service_zones?.[0]?.id

  if (!serviceZoneId) {
    const fset = await fulfillment.createFulfillmentSets({
      name: "Eesti tarne",
      type: "shipping",
      service_zones: [
        { name: "Eesti", geo_zones: [{ country_code: "ee", type: "country" }] },
      ],
    } as any)
    serviceZoneId = (fset as any).service_zones[0].id
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: (fset as any).id },
    }).catch(() => {})
    logger.info(`checkout-setup — created fulfillment set + zone ${serviceZoneId}`)
  }

  // ── Shipping option (skip if one exists) ──────────────────────────────────
  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })
  if (!existingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Kuller",
          price_type: "flat",
          provider_id: FULFILLMENT_PROVIDER,
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Kuller", description: "Kullerveos 1–3 tööpäeva", code: "kuller" },
          prices: [{ currency_code: "eur", amount: 4.9 }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info("checkout-setup — created 'Kuller' shipping option (4.90 €)")
  }

  // ── Link payment provider to the region ───────────────────────────────────
  await link.create({
    [Modules.REGION]: { region_id: region.id },
    [Modules.PAYMENT]: { payment_provider_id: PAYMENT_PROVIDER },
  }).catch(() => {})

  logger.info("checkout-setup — DONE")
}
