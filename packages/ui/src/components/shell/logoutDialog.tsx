import type React from "react";

import { useLogout } from "../../lib/auth";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

type LogoutDialogProperties = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
};

/**
 * Logout confirmation (Drishti.dc.html's neutral-tone modal) — signing out
 * drops the stored access key, so a stray tap in the account menu shouldn't
 * do it immediately. The agent itself keeps running either way.
 * @param props.open - whether the dialog is showing
 * @param props.onOpenChange - called when the dialog opens or closes
 * @param props.onCloseAutoFocus - returns focus, since the dialog has no trigger
 * @returns Logout confirmation dialog element
 */
export function LogoutDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: LogoutDialogProperties): React.ReactElement {
  const logout = useLogout();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        onCloseAutoFocus={onCloseAutoFocus}
        title="Log out of Drishti?"
        description="You will be signed out on this device and returned to the access-key screen. The agent keeps running on the server."
      >
        <Dialog.Footer className="!mt-0">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={logout}>
            Log out
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
