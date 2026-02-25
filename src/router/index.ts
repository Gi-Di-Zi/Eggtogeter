import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
            meta: { requiresAuth: true }
        },
        {
            path: '/login',
            name: 'login',
            component: LoginView
        },
        {
            path: '/register',
            name: 'register',
            component: RegisterView
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('../views/ForgotPasswordView.vue')
        },
        {
            path: '/update-password',
            name: 'update-password',
            component: () => import('../views/UpdatePasswordView.vue'),
            // meta: { requiresAuth: true } // TODO: [AUTH-restore] Uncomment this for production
        },
        {
            path: '/edit',
            name: 'edit',
            component: () => import('../views/PhotoEditView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/album',
            name: 'album',
            component: () => import('../views/AlbumView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/album/:id',
            name: 'album-viewer',
            component: () => import('../views/AlbumViewerView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/album/:id/play',
            name: 'album-play',
            component: () => import('../views/AlbumRouteView.vue'),
            meta: { requiresAuth: false, layout: 'empty' }
        },
        {
            path: '/friends',
            name: 'friends',
            component: () => import('../views/FriendsView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/my',
            name: 'my',
            component: () => import('../views/MyView.vue'),
            meta: { requiresAuth: true }
        },
        {
            // 404 Not Found (Wildcard Match)
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: () => import('../views/NotFoundView.vue')
        }
    ]
})

router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()
    // Ensure we have the latest session data before deciding
    if (authStore.loading) {
        await authStore.initialize()
    }

    const isAuthenticated = authStore.isAuthenticated

    if (to.meta.requiresAuth && !isAuthenticated) {
        next({ name: 'login' })
    } else if ((to.name === 'login' || to.name === 'register') && isAuthenticated) {
        next({ name: 'home' })
    } else {
        next()
    }
})

export default router
