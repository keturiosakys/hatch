import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
			gcTime: 1000 * 60 * 60, // Unused data is garbage collected after 1 hour
			retry: 1, // Only retry failed requests once
			refetchOnWindowFocus: false, // Don't refetch when window regains focus
		},
		mutations: {
			retry: 1, // Only retry failed mutations once
		},
	},
});

export const Route = createRootRoute({
	component: () => (
		<QueryClientProvider client={queryClient}>
			<Outlet />
			<TanStackRouterDevtools initialIsOpen={false} position="bottom-right" />
		</QueryClientProvider>
	),
});
