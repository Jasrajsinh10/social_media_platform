from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    - Safe methods (GET, HEAD, OPTIONS): allowed for any authenticated user.
    - PUT / PATCH: allowed only for the object owner.
    - DELETE: allowed for the object owner OR any user with role='admin'.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        # Owner can do anything
        if obj.author == request.user:
            return True

        # Admin can delete any post
        if request.method == 'DELETE' and request.user.is_admin_role:
            return True

        return False


class IsCommentOwnerOrAdmin(permissions.BasePermission):
    """Delete permission for comments: owner or admin."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if obj.user == request.user:
            return True
        if request.method == 'DELETE' and request.user.is_admin_role:
            return True
        return False
