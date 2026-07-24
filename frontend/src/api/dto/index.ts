/**
 * Barrel for the API anti-corruption layer (DTO + mappers).
 *
 * Import stable frontend view models and mappers from '@/api/dto' rather than
 * reaching into individual domain modules.
 */
export type {
  AccountView,
  AccountListView,
} from './account'
export { mapAccount, mapAccountList } from './account'
