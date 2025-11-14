import { useRoutes } from 'react-router'
import { lazy } from 'react'

const DashboardFeature = lazy(() => import('@/features/dashboard/dashboard-feature.tsx'))
const AccountDetailFeature = lazy(() => import('@/features/account/account-feature-detail.tsx'))
const AccountIndexFeature = lazy(() => import('@/features/account/account-feature-index.tsx'))
const LotteryFeature = lazy(() => import('@/features/lottery/lottery-feature.tsx'))
const AdminFeature = lazy(() => import('@/features/admin/admin-feature.tsx'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <DashboardFeature /> },
    {
      path: 'account',
      children: [
        { index: true, element: <AccountIndexFeature /> },
        { path: ':address', element: <AccountDetailFeature /> },
      ],
    },
    { path: 'lottery', element: <LotteryFeature /> },
    { path: 'admin', element: <AdminFeature /> },
  ])
}
