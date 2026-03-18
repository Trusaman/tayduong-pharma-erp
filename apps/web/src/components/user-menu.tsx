import { api } from "@tayduong-pharma-erp/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";

export default function UserMenu() {
	const user = useQuery(api.auth.getCurrentUser);
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSignOut = async () => {
		if (isSigningOut) {
			return;
		}

		setIsSigningOut(true);
		try {
			const { error } = await authClient.signOut();
			if (error) {
				toast.error(error.message || "Đăng xuất thất bại");
				return;
			}

			window.location.assign("/");
		} finally {
			setIsSigningOut(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				{user?.name}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{user?.email}</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						disabled={isSigningOut}
						onClick={() => {
							void handleSignOut();
						}}
					>
						{isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
