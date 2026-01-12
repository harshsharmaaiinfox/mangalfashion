import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin, BehaviorSubject } from 'rxjs';
import { Cart, CartAddOrUpdate } from '../../../../interface/cart.interface';
import { CartState } from '../../../../state/cart.state';
import { ClearCart, UpdateCart, DeleteCart, AddToCart } from '../../../../action/cart.action';
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

  constructor(
    private modalService: NgbModal,
    private store: Store,
    public cartService: CartService
  ) { }

  async openModal(product: Product) {
    this.modalOpen = true;
    this.product = product;
    this.quantity = 1; // Reset quantity

    // Reset and find Size attribute
    this.sizeAttribute = null;
    this.selectedSize = null;

    if (this.product && this.product.attributes) {
      // Find attribute by name 'Size' (case-insensitive)
      this.sizeAttribute = this.product.attributes.find(attr =>
        attr.name.toLowerCase() === 'size'
      ) || null;

      if (this.sizeAttribute && this.sizeAttribute.attribute_values.length > 0) {
        // Select first value by default
        this.selectedSize = this.sizeAttribute.attribute_values[0];
      }
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

  updateQuantity(qty: number) {
    if (this.quantity + qty >= 1) {
      this.quantity += qty;
    }
  }

  selectSize(value: AttributeValue) {
    this.selectedSize = value;
  }

  addToCart() {
    if (this.product) {
      const params: CartAddOrUpdate = {
        id: null, // New item
        product: this.product,
        product_id: this.product.id,
        variation_id: null, // If we had variation logic we'd map size to variation here
        variation: null,
        quantity: this.quantity
      }
      this.store.dispatch(new AddToCart(params)).subscribe({
        complete: () => {
          this.closeModal();
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

