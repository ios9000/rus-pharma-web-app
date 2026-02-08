// Image upload module for Supabase Storage
// Bucket: content-images (public)

const ImageUpload = (() => {
    const BUCKET = 'content-images';

    /**
     * Upload a file to Supabase Storage.
     * @param {File} file
     * @param {string} folder - e.g. 'questions' or 'drugs'
     * @returns {Promise<{url: string, path: string} | null>}
     */
    async function upload(file, folder) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user.id}/${folder}/${timestamp}_${safeName}`;

        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;

        const { data: urlData } = supabaseClient.storage
            .from(BUCKET)
            .getPublicUrl(data.path);

        return { url: urlData.publicUrl, path: data.path };
    }

    /**
     * Remove a file from Supabase Storage by its full path.
     * @param {string} filePath - path inside the bucket
     */
    async function remove(filePath) {
        if (!filePath) return;
        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .remove([filePath]);
        if (error) throw error;
    }

    /**
     * Extract storage path from a public URL so it can be deleted.
     * @param {string} url
     * @returns {string|null}
     */
    function pathFromUrl(url) {
        if (!url) return null;
        const marker = `/object/public/${BUCKET}/`;
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        return url.substring(idx + marker.length);
    }

    return { upload, remove, pathFromUrl };
})();
