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

const companyLogoSrc = encodeURI("/image/Logo Tây Dương tách nền.png");

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
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        className="h-10 min-w-[120px] justify-start gap-2 px-2.5 sm:min-w-[160px] sm:px-3"
                    />
                }
            >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-slate-200 bg-white p-1 shadow-sm">
                    <img
                        src={companyLogoSrc}
                        alt="Tây Dương Logo"
                        onError={(event) => {
                            event.currentTarget.style.display = "none";
                        }}
                        className="h-full w-full object-contain"
                    />
                </span>
                <span className="flex-1 truncate text-left text-slate-700">
                    {user?.name ?? "Tài khoản"}
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-60 max-w-[calc(100vw-1rem)] bg-card"
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="whitespace-normal break-all leading-relaxed">
                        {user?.email}
                    </DropdownMenuItem>
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
