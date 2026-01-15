import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin, BehaviorSubject } from 'rxjs';
import { Cart, CartAddOrUpdate } from '../../../../interface/cart.interface';
import { CartState } from '../../../../state/cart.state';
import { ClearCart, UpdateCart, DeleteCart, AddToCart } from '../../../../action/cart.action';
import { AddToWishlist, DeleteWishlist } from '../../../../action/wishlist.action';
import { Router } from '@angular/router';
import { CartService } from '../../../../services/cart.service';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../interface/product.interface';
import { Attribute, AttributeValue } from '../../../../interface/attribute.interface';

@Component({
  selector: 'app-cart-popup-modal',
  templateUrl: './cart-popup-modal.component.html',
  styleUrls: ['./cart-popup-modal.component.scss']
})
export class CartPopupModalComponent implements OnDestroy {

  @ViewChild("cartPopupModal", { static: false }) cartPopupModal: TemplateRef<any>;

  public closeResult: string;
  public modalOpen: boolean = false;
  public product: Product | null = null;
  public quantity: number = 1;

  public sizeAttribute: Attribute | null = null;
  public selectedSize: AttributeValue | null = null;

  public waistAttribute: Attribute | null = null;
  public selectedWaist: AttributeValue | null = null;

  public availableSizeValues: AttributeValue[] = [];
  public availableWaistValues: AttributeValue[] = [];

  public addToCartLoader: boolean = false;

  constructor(
    private modalService: NgbModal,
    private store: Store,
    public cartService: CartService
  ) { }

  async openModal(product: Product) {
    this.modalOpen = true;
    this.product = product;
    this.quantity = 1; // Reset quantity
    this.addToCartLoader = false; // Reset loader

    // Reset and find Size attribute
    this.sizeAttribute = null;
    this.selectedSize = null;
    this.waistAttribute = null;
    this.selectedWaist = null;
    this.availableSizeValues = [];
    this.availableWaistValues = [];

    if (this.product && this.product.attributes) {
      // Find attribute by name 'Size' (case-insensitive)
      this.sizeAttribute = this.product.attributes.find(attr =>
        attr.name.toLowerCase() === 'size'
      ) || null;

      // Find attribute by name 'Waist' (case-insensitive)
      this.waistAttribute = this.product.attributes.find(attr =>
        attr.name.toLowerCase() === 'waist'
      ) || null;

      // Filter available attribute values based on existing variations
      this.filterAvailableAttributeValues();
    }

    this.modalService.open(this.cartPopupModal, {
      ariaLabelledBy: 'Cart-Popup-Modal',
      centered: true,
      windowClass: 'theme-modal cart-popup-modal',
      backdrop: 'static',
      keyboard: true
    }).result.then((result) => {
      `Result ${result}`
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: ModalDismissReasons): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  filterAvailableAttributeValues() {
    if (!this.product?.variations) return;

    // Reset available values
    this.availableSizeValues = [];
    this.availableWaistValues = [];

    // Filter size values
    if (this.sizeAttribute) {
      this.availableSizeValues = this.sizeAttribute.attribute_values.filter(sizeValue =>
        this.product!.variations.some(variation =>
          variation.attribute_values.some(attrVal => attrVal.id === sizeValue.id)
        )
      );

      // Set default selection for size
      if (!this.selectedSize || !this.availableSizeValues.find(v => v.id === this.selectedSize!.id)) {
        this.selectedSize = this.availableSizeValues.length > 0 ? this.availableSizeValues[0] : null;
      }
    }

    // Filter waist values
    if (this.waistAttribute) {
      this.availableWaistValues = this.waistAttribute.attribute_values.filter(waistValue =>
        this.product!.variations.some(variation =>
          variation.attribute_values.some(attrVal => attrVal.id === waistValue.id)
        )
      );

      // Set default selection for waist
      if (!this.selectedWaist || !this.availableWaistValues.find(v => v.id === this.selectedWaist!.id)) {
        this.selectedWaist = this.availableWaistValues.length > 0 ? this.availableWaistValues[0] : null;
      }
    }

    console.log('🎯 FILTERED AVAILABLE VALUES:', {
      sizeAttribute: this.sizeAttribute?.name,
      availableSizes: this.availableSizeValues.map(v => v.value),
      selectedSize: this.selectedSize?.value,
      waistAttribute: this.waistAttribute?.name,
      availableWaists: this.availableWaistValues.map(v => v.value),
      selectedWaist: this.selectedWaist?.value
    });
  }

  updateQuantity(qty: number) {
    if (this.quantity + qty >= 1) {
      this.quantity += qty;
    }
  }

  selectSize(value: AttributeValue) {
    this.selectedSize = value;
  }

  selectWaist(value: AttributeValue) {
    this.selectedWaist = value;
  }

  addToCart() {
    if (this.product) {
      this.addToCartLoader = true; // Start loader
      let selectedVariation: any = null;
      let selectedVariationId: number | null = null;

      // If product has variations
      if (this.product.type === 'classified' && this.product.variations && this.product.variations.length > 0) {

        // Find variation that matches the selected attributes (Size and/or Waist)
        console.log('🔍 VARIATION SEARCH - Looking for:', {
          selectedSize: this.selectedSize,
          selectedWaist: this.selectedWaist,
          productVariations: this.product.variations?.length
        });

        // Debug: Log all variations and their attribute values
        this.product.variations?.forEach((variation, index) => {
          console.log(`Variation ${index + 1}:`, {
            id: variation.id,
            name: variation.name,
            attribute_values: variation.attribute_values,
            selected_variation: variation.selected_variation
          });
        });

        const foundVariation = this.product.variations.find(variation => {
          let match = true;

          // Check Size match if size is selected
          if (this.selectedSize) {
            const sizeMatch = variation.attribute_values?.some(attrVal => attrVal.id === this.selectedSize?.id);
            console.log(`Size check for variation ${variation.id}:`, {
              selectedSizeId: this.selectedSize?.id,
              variationAttrIds: variation.attribute_values?.map(v => v.id),
              sizeMatch
            });
            if (!sizeMatch) match = false;
          }

          // Check Waist match if waist is selected
          if (this.selectedWaist) {
            const waistMatch = variation.attribute_values?.some(attrVal => attrVal.id === this.selectedWaist?.id);
            console.log(`Waist check for variation ${variation.id}:`, {
              selectedWaistId: this.selectedWaist?.id,
              variationAttrIds: variation.attribute_values?.map(v => v.id),
              waistMatch
            });
            if (!waistMatch) match = false;
          }

          console.log(`Variation ${variation.id} match result:`, match);
          return match;
        });

        if (foundVariation) {
          selectedVariation = {
            ...foundVariation,
            // Ensure selected_variation is set if missing
            selected_variation: foundVariation.selected_variation ||
              foundVariation.attribute_values?.map(attr => attr.value)?.filter(value => value)?.join('/') || ''
          };
          selectedVariationId = foundVariation.id;
          console.log('✅ CART POPUP - FOUND Variation:', {
            id: foundVariation.id,
            name: foundVariation.name,
            attribute_values: foundVariation.attribute_values,
            original_selected_variation: foundVariation.selected_variation,
            constructed_selected_variation: selectedVariation.selected_variation
          });
        } else {
          console.log('❌ CART POPUP - NO Variation found for selected attributes');
        }
      }

      const params: CartAddOrUpdate = {
        id: null, // New item
        product: this.product,
        product_id: this.product.id,
        variation_id: selectedVariationId,
        variation: selectedVariation,
        quantity: this.quantity
      }

      console.log('🛒 CART POPUP - Adding to Cart:', {
        product_name: this.product?.name,
        variation_id: selectedVariationId,
        variation: selectedVariation,
        params: params
      });

      this.store.dispatch(new AddToCart(params)).subscribe({
        complete: () => {
          this.addToCartLoader = false; // Stop loader
          this.closeModal();
        },
        error: () => {
          this.addToCartLoader = false; // Stop loader on error
        }
      });
    }
  }

  toggleWishlist(product: Product) {
    product['is_wishlist'] = !product['is_wishlist'];
    let action = product['is_wishlist'] ? new AddToWishlist({ product_id: product.id }) : new DeleteWishlist(product.id);
    if (action) {
      this.store.dispatch(action);
    }
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

