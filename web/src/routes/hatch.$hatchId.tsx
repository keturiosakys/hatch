import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hatch/$hatchId")({
	component: Hatch,
	loader: async ({ params }) => {
		console.log(params);
		return null;
	},
});

function Hatch() {
	const { hatchId } = Route.useParams();
	return <div className="p-2 text-white">Hatch {hatchId}</div>;
}
