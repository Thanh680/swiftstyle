<?php
/**
 * Plugin Name: SwiftStyle
 * Description: Ajoute le bouton « Trouver ma taille » de SwiftStyle aux fiches produit WooCommerce.
 * Version: 0.1.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Text Domain: swiftstyle
 *
 * ARCHITECTURE-TECHNIQUE.md § 7.2 : deux hooks, une page de réglages, un sélecteur de secours.
 */

if (!defined('ABSPATH')) {
    exit;
}

const SWIFTSTYLE_DEFAULT_SRC = 'https://cdn.swiftstyle.app/v1/widget.js';

function swiftstyle_option($name, $default = '') {
    $value = get_option('swiftstyle_' . $name, $default);
    return is_string($value) && $value !== '' ? $value : $default;
}

/* ---------- Point d'insertion standard ---------- */

$GLOBALS['swiftstyle_printed'] = false;

function swiftstyle_root($target = '') {
    global $product;
    if (!$product || $GLOBALS['swiftstyle_printed'] || swiftstyle_option('public_key') === '') {
        return;
    }
    $GLOBALS['swiftstyle_printed'] = true;
    printf(
        '<div id="swiftstyle-root" data-product-id="%d" data-shop-key="%s"%s></div>',
        $product->get_id(),
        esc_attr(swiftstyle_option('public_key')),
        $target !== '' ? ' data-target="' . esc_attr($target) . '"' : ''
    );
}

// 30 = formulaire d'ajout au panier, 35 le place juste en dessous.
add_action('woocommerce_single_product_summary', function () {
    swiftstyle_root();
}, 35);

// Secours : certains thèmes surchargent le template produit et n'appellent jamais
// le hook ci-dessus. Le script du widget déplace alors le bouton après le sélecteur configuré.
add_action('wp_footer', function () {
    if (!function_exists('is_product') || !is_product()) {
        return;
    }
    global $product;
    if (!$product instanceof WC_Product) {
        $product = wc_get_product(get_the_ID());
    }
    swiftstyle_root(swiftstyle_option('fallback_selector', 'form.cart'));
});

add_action('wp_enqueue_scripts', function () {
    if (!function_exists('is_product') || !is_product() || swiftstyle_option('public_key') === '') {
        return;
    }
    wp_enqueue_script('swiftstyle', swiftstyle_option('script_src', SWIFTSTYLE_DEFAULT_SRC), [], null, [
        'in_footer' => true,
        'strategy'  => 'async',
    ]);
});

/* ---------- Page de réglages ---------- */

add_action('admin_init', function () {
    register_setting('swiftstyle', 'swiftstyle_public_key', ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('swiftstyle', 'swiftstyle_fallback_selector', ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('swiftstyle', 'swiftstyle_script_src', ['sanitize_callback' => 'esc_url_raw']);
});

add_action('admin_menu', function () {
    add_options_page('SwiftStyle', 'SwiftStyle', 'manage_options', 'swiftstyle', 'swiftstyle_settings_page');
});

function swiftstyle_settings_page() {
    $fields = [
        'public_key'        => ['Clé publique', 'Commence par pk_. Transmise par l\'équipe SwiftStyle.', ''],
        'fallback_selector' => ['Sélecteur de secours', 'Utilisé seulement si votre thème n\'appelle pas le hook produit standard.', 'form.cart'],
        'script_src'        => ['URL du script', 'À laisser vide, sauf pour tester un environnement de préproduction.', ''],
    ];
    ?>
    <div class="wrap">
        <h1>SwiftStyle</h1>
        <form method="post" action="options.php">
            <?php settings_fields('swiftstyle'); ?>
            <table class="form-table" role="presentation">
                <?php foreach ($fields as $name => [$label, $help, $placeholder]) : ?>
                    <tr>
                        <th scope="row"><label for="swiftstyle_<?php echo esc_attr($name); ?>"><?php echo esc_html($label); ?></label></th>
                        <td>
                            <input class="regular-text" id="swiftstyle_<?php echo esc_attr($name); ?>"
                                   name="swiftstyle_<?php echo esc_attr($name); ?>"
                                   value="<?php echo esc_attr(get_option('swiftstyle_' . $name, '')); ?>"
                                   placeholder="<?php echo esc_attr($placeholder); ?>">
                            <p class="description"><?php echo esc_html($help); ?></p>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
